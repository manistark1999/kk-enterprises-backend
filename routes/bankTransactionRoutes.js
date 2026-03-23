const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/bankTransactionController');

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.remove);
router.get('/summary', ctrl.getSummary);

module.exports = router;
