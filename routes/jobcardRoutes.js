const express = require('express');
const router = express.Router();
const {
  getJobcards,
  createJobcard,
  updateJobcard,
  deleteJobcard,
  getJobcardById,
  getNextNumber
} = require('../controllers/jobcardController');

router.get('/', getJobcards);
router.get('/next-number', getNextNumber);
router.get('/:id', getJobcardById);
router.post('/', createJobcard);
router.put('/:id', updateJobcard);
router.delete('/:id', deleteJobcard);

module.exports = router;
