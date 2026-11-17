const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/catalogController');

router.get('/', catalogController.getCatalog);
router.get('/:id', catalogController.getBookDetails);

module.exports = router;
