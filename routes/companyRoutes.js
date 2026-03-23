const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/companyController');

router.get('/', ctrl.get);
router.post('/', ctrl.upsert);
router.put('/', ctrl.upsert);

module.exports = router;
