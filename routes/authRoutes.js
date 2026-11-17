const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { forwardAuthenticated, ensureAuthenticated } = require('../middleware/auth');

router.get('/login', forwardAuthenticated, authController.getLogin);
router.post('/login', forwardAuthenticated, authController.postLogin);

router.get('/register', forwardAuthenticated, authController.getRegister);
router.post('/register', forwardAuthenticated, authController.postRegister);

router.get('/logout', ensureAuthenticated, authController.getLogout);

module.exports = router;
