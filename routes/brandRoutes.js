const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/brandController');

// Brands
router.get('/', ctrl.getAllBrands);
router.post('/', ctrl.createBrand);
router.put('/:id', ctrl.updateBrand);
router.delete('/:id', ctrl.removeBrand);

module.exports = router;
