const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/salaryAdvanceController');

// Salaries
router.get('/salaries', ctrl.getAllSalaries);
router.post('/salaries', ctrl.createSalary);
router.put('/salaries/:id', ctrl.updateSalary);
router.delete('/salaries/:id', ctrl.deleteSalary);

// Advances
router.get('/advances', ctrl.getAllAdvances);
router.post('/advances', ctrl.createAdvance);
router.delete('/advances/:id', ctrl.deleteAdvance);

module.exports = router;
