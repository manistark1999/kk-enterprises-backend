const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financialYearController');

router.get('/', ctrl.getAll);
router.post('/', ctrl.create);
router.put('/:id/activate', ctrl.setActive);
router.delete('/:id', ctrl.remove);

module.exports = router;
