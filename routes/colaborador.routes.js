const express = require('express');
const router = express.Router();
const colaboradorController = require('../controllers/colaborador.controller');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth.middleware');

router.post('/agregar-colaborador/', authenticateToken, authorizeRoles(['admin']), colaboradorController.createColaborador);

router.put('/actualizar-colaborador/:id', authenticateToken, authorizeRoles(['admin','supervisor']), colaboradorController.updateColaborador);

router.get('/colaboradores/', authenticateToken, authorizeRoles(['admin','supervisor']), colaboradorController.findAllColaboradores);

router.get('/colaboradores-with-user/', authenticateToken, authorizeRoles(['admin']), colaboradorController.findAllColaboradoresWithUser);

router.delete('/eliminar-colaborador/:id', authenticateToken, authorizeRoles(['admin']), colaboradorController.deleteColaborador);

router.get('/colaborador/:id', authenticateToken, authorizeRoles(['admin']), colaboradorController.findOneColaborador);

//especifica
router.get('/colaboradores-usuarios/', authenticateToken, authorizeRoles(['admin']), colaboradorController.findColaboradoresSinUsuario);

module.exports = router;