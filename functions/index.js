require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('../models');
const {auditTables} = require('../middlewares/audit.middleware');
const serverless = require('serverless-http');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(cors());

// Define las rutas del API
app.use('/.netlify/functions/index/saag', require('../routes/solicitud.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/ausencia.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/usuario.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/colaborador.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/horasExtra.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/puesto.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/auditoria.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/auditoriaLogin.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/expediente.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/documento.routes'));
app.use('/.netlify/functions/index/saag', require('../routes/telefono.routes'));
app.use(auditTables);

app.use('/.netlify/functions/index/saag', require('../routes/login.routes'));

// Sincroniza la base de datos
db.sequelize.sync().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
  });
});

module.exports.handler = serverless(app);



