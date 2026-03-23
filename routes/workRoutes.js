const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/workController');

// Work Groups
router.get('/groups', ctrl.getWorkGroups);
router.post('/groups', ctrl.createWorkGroup);
router.put('/groups/:id', ctrl.updateWorkGroup);
router.delete('/groups/:id', ctrl.deleteWorkGroup);

// Work Types
router.get('/types', ctrl.getWorkTypes);
router.post('/types', ctrl.createWorkType);
router.put('/types/:id', ctrl.updateWorkType);
router.delete('/types/:id', ctrl.deleteWorkType);

module.exports = router;
