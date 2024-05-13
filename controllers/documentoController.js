const enviarCorreo = require('./gmail.controller') 
const iconv = require('iconv-lite');
const db = require('../models');
const Colaborador = db.colaborador;
const Documento = db.documento;
const { getFileLength, getDateUploaded } = require('../mjs/functions');
const { Op } = require('sequelize');

exports.getDocsEmployee = async (req, res) => {
  const idColaborador = req.params.idColaborador;

  Documento.findAll({
    where: { idColaborador: idColaborador },
    attributes: {
      exclude: ['archivo']
    }
  }).then(documentos => {
      res.status(200).send(documentos);
  }).catch(error => {
      res.status(500).send({
        message: error
      });
  });
};

exports.findAll = (req, res) => {
  Documento.findAll({
    include: [
      {
        model: Colaborador,
        as: 'colaborador',
      },
    ],
  })
  .then(data => {
    res.send(data);
  })
  .catch(err => {
    res.status(500).send({
      message: err.message || 'Ocurrió un error al obtener los datos.'
    });
  });
};


exports.uploadPdf = async (req, res) => {  
    try {

      const {idColaborador, licencia, curso, fechaVencimiento} = req.body;

        if (!req.files || req.files.length === 0) {
            res.status(400).send({
                status: '400',
                message: 'No ha seleccionado ningun archivo...'
            });
        }
        const pdfFiles = [];
        for (const file of req.files) {
            const { originalname, buffer } = file;
            const cadenaDecodificada = iconv.decode(Buffer.from(originalname, 'latin1'), 'utf-8');
            const length = getFileLength(buffer.length);
            const pdfFile = await Documento.create({
                licencia: licencia,
                curso: curso,
                nombreArchivo: cadenaDecodificada,
                archivo: buffer,
                tamano: length,
                fechaVencimiento: fechaVencimiento,
                fechaSubida: getDateUploaded(),
                idColaborador: idColaborador
            });
            pdfFiles.push(pdfFile); 
        }
        res.status(200).send({ 
          message: 'Registrado exitosamente!...'
        });
    } catch (error) {
        res.status(500).send({
          message: 'Ocurrió un error al registrar el (los) documento(s)...',
          error: error
        });
    }
};
  
exports.getFileById = async (req, res) => {
    try {
      const { id } = req.params;
      const file = await Documento.findByPk(id);
  
      if (!file) {
          res.status(404).send({
            message: 'Archivo no encontrado'
          });
      }else {
        let contentType = 'application/octet-stream'; // Por defecto, tipo binario
        const fileExtension = file.nombreArchivo.split('.').pop().toLowerCase();

        if (fileExtension === 'pdf') {
          contentType = 'application/pdf';
        } else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
          contentType = `image/${fileExtension}`;
        }
        // Establece las cabeceras de respuesta
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${file.nombreArchivo}"`);
        res.send(file.archivo);
     }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPhotoCarnetById = async (req, res) => {
  try {
      const id  = req.params.idColaborador;
      const colaborador = await Colaborador.findByPk(id);
      if (!colaborador || !colaborador.fotoCarnet) {
          return res.status(404).send({
              message: 'Foto de carnet no encontrada'
          });
      }
      
      const contentType = 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.send(colaborador.fotoCarnet);
  } catch (error) {
      console.error(errorerror);
      return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

exports.getFotoCarnet = async (req, res) => {
  const idColaborador = req.params.idColaborador;
  
  try {
    const colaborador = await Colaborador.findByPk(idColaborador);
    
    if (!colaborador) {
      return res.status(404).json({ message: 'Colaborador no encontrado' });
    }

    const fotoCarnetBuffer = colaborador.fotoCarnet;

    if (!fotoCarnetBuffer) {
      return res.status(404).json({ message: 'Foto no registrada' });
    }

    const base64 = fotoCarnetBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64}`;

    res.json({ idColaborador, imageUrl });
  } catch (error) {
    console.error('Error al obtener la foto de carnet:', error.message);
    res.status(500).json({ message: 'Error al obtener la foto de carnet', error: error.message });
  }
};


exports.deleteDocumento = (req, res) => {
  
  Documento.findByPk(req.params.id)
  .then((documento)=> {
    if(documento){
      documento.destroy()
      .then(() => {
        res.status(200).send({
          message: 'Eliminado exitosamente!'
        });
      }).catch(error => {
        res.status(500).send({
          message: error
        });
      })
    }else{
      res.status(404).send({
        message: 'No se encontró ningún registro con el id especificado.'
      });
    }
  }).catch(error => {
    res.status(500).send({
      message: error
    });
  });
}

const obtenerColaboradores = async (identificadores) => {
  try {
    const colaboradores = await Colaborador.findAll({
      where: {
        idColaborador: {
          [Op.in]: identificadores
        }
      },
      attributes: ['idColaborador', 'correoElectronico'] // Seleccionar también el ID del colaborador
    });
    return colaboradores.map(colaborador => ({
      idColaborador: colaborador.idColaborador,
      correoElectronico: colaborador.correoElectronico
    }));
  } catch (error) {
      console.error('Error al obtener colaboradores:', error.message);
      return [];
  }
};

const enviarCorreos = async () => {
  const documentos = await Documento.findAll();
  let mensaje = '';
  const hoy = new Date();
  // Verificar si no hay documentos
  if (documentos.length === 0) {
    console.log('No hay documentos para enviar correos.');
  } else {
    const vencidos = [];
    const porVencerse = [];
    // Filtro de documentos vencidos y por vencerse
    documentos.forEach(documento => {
      const vencimiento = new Date(documento.fechaVencimiento);
      const diasRestantes = Math.floor((vencimiento - hoy) / (1000 * 60 * 60 * 24));
      console.log(vencimiento + " " + hoy + " dias restantes = "+ diasRestantes);
      console.log(`Documento: ${documento.nombreArchivo}, Fecha de vencimiento: ${vencimiento.toISOString()}, Días restantes: ${diasRestantes}`); // ya lo muestra
      if (diasRestantes <= 0) {
        vencidos.push(documento);
      } else if (diasRestantes <= 90 && (diasRestantes % 90 === 0 || diasRestantes % 60 === 0 || diasRestantes === 15 || diasRestantes === 7 || diasRestantes === 2)) {
        porVencerse.push(documento);
      }
    });
    // Obtener correos de colaboradores
    const idColaboradoresVencidos = vencidos.map(documento => documento.idColaborador);
    const idColaboradoresPorVencerse = porVencerse.map(documento => documento.idColaborador);

    const colaboradores = await obtenerColaboradores([...new Set([...idColaboradoresVencidos, ...idColaboradoresPorVencerse])]);
    
    // Verificar si hay correos para enviar
    if (colaboradores.length === 0) {
      console.log('No hay correos para enviar.');
    } else {
      const from = "Informacion relevante";
      console.log("correo");
      // Crear un mapa de documentos por ID de colaborador
      const documentosPorColaborador = {};
      documentos.forEach(documento => {
        if (!documentosPorColaborador[documento.idColaborador]) {
          documentosPorColaborador[documento.idColaborador] = [];
        }
        documentosPorColaborador[documento.idColaborador].push(documento);
      });

      for (const colaborador of colaboradores) {
        const { idColaborador, correoElectronico } = colaborador;
        // Obtener documentos del colaborador actual
        const documentosColaborador = documentosPorColaborador[idColaborador] || [];
        console.log("supuestamente correos: "+ documentosColaborador);
        // Separar documentos vencidos y por vencerse
        const documentosVencidos = documentosColaborador.filter(documento => vencidos.includes(documento));
        const documentosPorVencerse = documentosColaborador.filter(documento => porVencerse.includes(documento));
        // Crear mensaje para documentos vencidos y por vencerse del colaborador
        const mensajeVencidos = documentosVencidos.map(documento => `<tr><td>El documento ${documento.nombreArchivo}  </td><td>está vencido  </td><td>diferencia de ${Math.floor(((new Date(documento.fechaVencimiento) - hoy.getTime())) / (1000 * 60 * 60 * 24))} dia(s)</td></tr>`).join('\n');
        const mensajePorVencerse = documentosPorVencerse.map(documento => `<tr><td>El documento ${documento.nombreArchivo}</td> <td>está por vencerse</td><td>diferencia de ${Math.floor(((new Date(documento.fechaVencimiento) - hoy.getTime())) / (1000 * 60 * 60 * 24))} dia(s)</td></tr>`).join('\n');
        // Enviar correo si hay documentos vencidos o por vencerse para el colaborador
        console.log(`Documentos vencidos para ${correoElectronico}:`, mensajeVencidos);
        console.log(`Documentos por vencerse para ${correoElectronico}:`, mensajePorVencerse);
        console.log(hoy);
        if (mensajeVencidos || mensajePorVencerse) {
          mensaje += `<h2>Documentos vencidos y por vencerse</h2>
          <table>
            <tr>
              <th>Documento</th>
              <th>Estado</th>
              <th>Tiempo Restante</th>
            </tr>
            ${mensajeVencidos}
            ${mensajePorVencerse}
          </table>`;
          console.log("correos de documentos");
          await enviarCorreo([correoElectronico], 'Documentos', mensaje, from); // Envío de correo dentro del bucle
          mensaje = ``;
        }
      }
    }
  }

  if (enviarCorreo) {
    console.log('Correos enviados correctamente');
  }
};



const ejecutarFuncionDiaria = (hora, minuto, funcion) => {
  const ahora = new Date();
  let horaDeseada = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      hora,
      minuto,
      0,
      0
  );

  if (ahora > horaDeseada) {
      // Si la hora deseada ya pasó hoy, programarla para mañana
      horaDeseada.setDate(horaDeseada.getDate() + 1); // asignacion para el siguiente dia
      console.log('Programar la siguiente ejecución para:', horaDeseada);
  }

  // Calcular el tiempo restante para la próxima ejecución
  const tiempoParaEjecutar = horaDeseada - ahora;

  // Programar la ejecución de la función usando setTimeout
  setTimeout(() => {
      funcion();
      // Programar la siguiente ejecución para cierta hora
      ejecutarFuncionDiaria(hora, minuto, funcion);
  }, tiempoParaEjecutar);
};

// Función de autoejecución
(async () => {
  try {
      console.log("documentos");

      // Configurar la hora y el minuto deseados para enviar el correo
      const horaDeseada = 10; // 03:00 AM la mejor hora para hacerlo
      const minutoDeseado = 29;
      // Ejecutar la función una vez al día a la hora deseada
      ejecutarFuncionDiaria(horaDeseada, minutoDeseado, enviarCorreos);

  } catch (error) {
      console.error('Ocurrió un error:', error.message);
  }
})();
