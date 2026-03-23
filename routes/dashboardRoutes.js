const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');

router.get('/stats', ctrl.getStats);
router.get('/recent-activity', ctrl.getRecentActivity);
router.get('/stock-alerts', ctrl.getStockAlerts);


module.exports = router;
