const enviarCorreo = require("./gmail.controller"); // instancia de la funcion enviar correo
const db = require("../models");
const Solicitud = db.solicitud;
const Colaborador = db.colaborador; // Import the Colaborador model if not already imported
const multer = require("multer");
const iconv = require("iconv-lite");
const { getFileLength } = require("../mjs/functions");
// Crea una nueva solicitud
exports.create = async (req, res, next) => {
  try {
    // Verificar si se enviaron datos
    if (Object.keys(req.body).length === 0) {
      return res.status(400).send({
        message: "No puede venir sin datos",
      });
    }

    // Validar documento si se adjuntó uno
    const isValid = req.file ? validarDocumento(req) : true;
    if (!isValid) {
      return res.status(400).send({
        message: "Documento inválido",
      });
    }

    // Preparar documento
    const { cadenaDecodificada, buffer, length } = req.file
      ? preparacionDocumento(req)
      : { cadenaDecodificada: null, buffer: null, length: 0 };

    if(req.body.horaInicio === ''){
      req.body.horaInicio = null;
    }
    
    if(req.body.horaFin === ''){
      req.body.horaFin = null;
    }

    // Crea una nueva solicitud
    // Obtener datos del colaborador y su supervisor
    const colaborador = await Colaborador.findByPk(req.body.idColaborador, {
      include: [{
        model: Colaborador,
        as: 'supervisor',
        attributes: ['correoElectronico'],
      }],
    });

    // Enviar correo electrónico a colaborador y supervisor
    const colaboradorEmail = colaborador.correoElectronico;
    console.log(colaborador.supervisor);
    const supervisorEmail = colaborador.supervisor ? colaborador.supervisor.correoElectronico : null;
    console.log(supervisorEmail);
    const toList = [colaboradorEmail, supervisorEmail].filter(Boolean);
    const subject = "Solicitud de nuevo colaborador";
    const from = '"Se agregó como una nueva solicitud" <dgadeaio4@gmail.com>';
    const htmlContent = `
      <style>
        h2 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
      </style>
      <h2>Informacion de la nueva solicitud</h2>
      <table>
        <tr><th>Información</th><th>Datos</th></tr>
        <tr><td>Nombre del Colaborador:</td><td>${req.body.nombreColaborador}</td></tr>
        <tr><td>Salario con goce:</td><td>${req.body.conGoceSalarial === 1 ? 'Sí' : 'No'}</td></tr>
        <tr><td>Tipo de solicitud:</td><td>${req.body.tipoSolicitud}</td></tr>
        <tr><td>Encargado:</td><td>${req.body.nombreEncargado}</td></tr>
        <tr><td>Tiempo a solicitar:</td><td>${req.body.fechaInicio} - ${req.body.fechaFin}</td></tr>
      </table>
    `;
    // Crear nueva solicitud
    const data = await Solicitud.create({
      ...req.body,
      comprobante: buffer,
      tamanio: length,
      nombreArchivo: cadenaDecodificada,
    });
    // enviamos el correo despues de registrar la solicitud
    await enviarCorreo(toList, subject, htmlContent, from);
    // Enviar respuesta al cliente
    res.status(200).send({
      message: `Solicitud creada correctamente para ${req.body.nombreColaborador}`,
      data: data,
    });
    next();
  } catch (err) {
    console.error(err); // Registrar el error en la consola o en un sistema de registro de errores
    res.status(500).send({
      message: err.message || "Ocurrió un error al crear la solicitud.",
    });
  }
};

exports.findAll = (req, res, next) => {
  //en Express.js toman dos argumentos: req (la solicitud) y res (la respuesta).
  Solicitud.findAll({
    include: [
      {
        model: Colaborador,
        as: "colaborador",
        attributes: {
          exclude: ["fotoCarnet"],
        },
      },
    ],
    attributes: {
      exclude: ["comprobante", "nombreArchivo", "tamanio"], // Excluir campos adicionales de la Solicitud
    },
  })
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Ocurrió un error al obtener las solicitudes.",
      });
    });
};

exports.findAllBySupervisor = (req, res, next) => {
  const idSupervisor = req.params.id; // Supongamos que recibes el ID del supervisor desde el front-end

  Solicitud.findAll({
    include: [
      {
        model: Colaborador,
        as: "colaborador",
        attributes: {
          exclude: ["fotoCarnet"],
        },
        where: {
          idColaborador_fk: idSupervisor,
        },
      },
    ],
  })
    .then((data) => {
      console.log(data);
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Ocurrió un error al obtener las solicitudes.",
      });
    });
};



/**
 * 
exports.findAllBySupervisor = (req, res, next) => {
  const idSupervisor = req.params.id; // Supongamos que recibes el ID del supervisor desde el front-end

  Solicitud.findAll({
    include: [
      {
        model: Colaborador,
        as: "colaborador",
        attributes: {
          exclude: ["fotoCarnet"],
        },
        where: {
          idColaborador_fk: idSupervisor,
        },
      },
    ],
  })
    .then((data) => {
      console.log(data);
      res.send(data);
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Ocurrió un error al obtener las solicitudes.",
      });
    });
};
 */

// Obtiene una solicitud por ID
exports.findOne = (req, res, next) => {
  const id = req.params.id;


  Solicitud.findByPk(id)
    .then((data) => {
      if (!data) {
        res.status(404).send({
          message: `No se encontró una solicitud con ID ${id}`,
        });
      } else {
        res.send(data);
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: `Ocurrió un error al obtener la solicitud con ID ${id}`,
      });
    });
};

// Actualiza una solicitud por ID
exports.update = (req, res, next) => {
  const id = req.params.id;
  // Busca la solicitud en la base de datos
  // Validación del documento si está presente
  const isValid = req.file ? validarDocumento(req) : true;
  if (!isValid) return; // Si la validación falla, se detiene el proceso

  // Preparación del documento adjunto si está presente
  const { cadenaDecodificada, buffer, length } = req.file
    ? preparacionDocumento(req)
    : { cadenaDecodificada: null, buffer: null, length: 0 };

  // Convertir horas vacías a null si es necesario
  if (req.body.horaInicio === "") {
    req.body.horaInicio = null;
  }

  if (req.body.horaFin === "") {
    req.body.horaFin = null;
  }

  Solicitud.findByPk(id)
    .then((solicitud) => {
      if (!solicitud) {
        res.status(404).send({
          message: `No se encontró una solicitud con ID ${id}`,
        });
      } else {
        req.datos = { ...solicitud.get() };
        // Actualiza la solicitud con los nuevos datos del cuerpo de la solicitud
        const comprobante = buffer ? buffer : solicitud.comprobante;
        const tamanio = buffer ? length : solicitud.tamanio;
        const nombreArchivo = buffer ? cadenaDecodificada : solicitud.nombreArchivo;
        const comentario = req.body.comentario !== undefined ? req.body.comentario : solicitud.comentario;
        const estado = req.body.estado !== undefined ? req.body.comentario : solicitud.estado;

        solicitud
          .update({
            ...req.body,
            comprobante: comprobante,
            tamanio: tamanio,
            nombreArchivo: nombreArchivo,
            comentario: comentario,
            estado:estado
          })
          .then(async () => {
            res.status(200).send({
              message: `Actualizada correctamente la solicitud con ID ${id}`,
              solicitud:solicitud
            }); 
            next();   
            const from = '"Se ha Actualizado la Solicitud numero: "'+`${req.body.idSolicitud}`;
            console.log(req.body.idColaborador);
            const toList = [req.body.nombreColaborador];
            const subject = "Actualizacion de solicitud";
            const htmlContent = `
                <style>
                    h2 {
                        color: #333;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        padding: 10px;
                        text-align: left;
                        border-bottom: 1px solid #ddd;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                </style>
                <h2>Informacion de la nueva solicitud</h2>
                <table>
                    <tr>
                        <th>Información</th>
                        <th>Datos</th>
                    </tr>
                    <tr>
                        <td>nombre del Colaborador:</td>
                        <td>${req.body.nombreColaborador}</td>
                    </tr>
                    <tr>
                        <td>salario :</td>
                        <td>${req.body.conGoceSalarial}</td>
                    </tr>
                    <tr>
                        <td>Solicitud de tipo:</td>
                        <td>${req.body.tipoSolicitud}</td>
                    </tr>
                    <tr>
                        <td>Estado de la Solicitud:</td>
                        <td>${req.body.estado}</td>
                    </tr>
                    <tr>
                        <td>Tiempo:</td>
                        <td>${req.body.fechaInicio} - ${req.body.fechaFin}</td>
                    </tr>
                </table>
            `;
            await enviarCorreo(toList, subject, htmlContent, from);
          })
          .catch((err) => {
            res.status(500).send({
              message: `Ocurrió un error al actualizar la solicitud con ID ${id}: ${err.message}`,
            });
          });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: `Ocurrió un error al obtener la solicitud con ID ${id}: ${err.message}`,
      });
    });
};

exports.delete = (req, res, next) => {
  const id = req.params.id;

  // Busca la solicitud en la base de datos
  Solicitud.findByPk(id)
    .then((solicitud) => {
      if (!solicitud) {
        res.status(404).send({
          message: `No se encontró una solicitud con ID ${id}`,
        });
      } else {
        req.datos = { ...solicitud.get() };
        // Elimina la solicitud de la base de datos
        solicitud
          .destroy()
          .then(() => {
            res.send({
              message: "La solicitud fue eliminada exitosamente",
            });
            next();
          })
          .catch((err) => {
            res.status(500).send({
              message:
                err.message ||
                `Ocurrió un error al eliminar la solicitud con ID ${id}`,
            });
          });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: `Ocurrió un error al obtener la solicitud con ID ${id}`,
      });
    });
};

exports.getAllSolicitudesPorColaborador = (req, res, next) => {
  const colaboradorId = req.params.id;

  Solicitud.findAll({
    where: { idColaborador: colaboradorId },
    include: [{ model: Colaborador, as: "colaborador" }],
  })
    .then((data) => {
      if (data.length === 0) {
        res.status(404).send({
          message: "No se encontraron solicitudes para este colaborador",
        });
      } else {
        res.send(data);
      }
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message ||
          "Ocurrió un error al obtener las solicitudes del colaborador.",
      });
    });
};


const validarDocumento = (req) => {
  if (!req.file || req.file.length === 0) {
    return res.status(400).send({
      status: "400",
      message: "No ha seleccionado ningún archivo...",
    });
  }

  const allowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
  ];
  const uploadedFile = req.file;

  if (!allowedMimeTypes.includes(uploadedFile.mimetype)) {
    return res.status(400).send({
      status: "400",
      message:
        "El archivo seleccionado no es válido. Sólo se admiten archivos PDF o imágenes.",
    });
  }

  return true;
};

const preparacionDocumento = (req) => {
  const file = req.file;
  const { originalname, buffer } = file;
  const cadenaDecodificada = iconv.decode(
    Buffer.from(originalname, "latin1"),
    "utf-8"
  );
  const length = getFileLength(buffer.length);
  return { cadenaDecodificada, buffer, length };
};

exports.getFileById = async (req, res) => {
  try {
    const { id } = req.params;
    const solicitud = await Solicitud.findByPk(id, {
      attributes: ["nombreArchivo", "comprobante", "tamanio"], // Selecciona los campos necesarios
    });

    if (!solicitud) {
      return res.status(404).send({
        message: "Solicitud no encontrada",
      });
    }

    if (solicitud.nombreArchivo===null) {
      return res.status(500).send({
        message: "El nombre del archivo no está disponible",
      });
    }else{

    // Establece el tipo de contenido según la extensión del archivo
    let contentType = "application/octet-stream"; // Por defecto, tipo binario
    const fileExtension = solicitud.nombreArchivo
      .split(".")
      .pop()
      .toLowerCase();

    if (fileExtension === "pdf") {
      contentType = "application/pdf";
    } else if (["jpg", "jpeg", "png", "gif"].includes(fileExtension)) {
      contentType = `image/${fileExtension}`;
    }

    // Establece las cabeceras de respuesta
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${solicitud.nombreArchivo}"`
    );
    res.send(solicitud.comprobante);
  }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
  
};
