const express = require("express");
const router = express.Router();
const {
  createEstimation,
  getAllEstimations,
  getNextEstimationNo,
  updateEstimation,
  deleteEstimation,
} = require("../controllers/estimationController");

router.get("/next-number", getNextEstimationNo);

router.route("/")
  .post(createEstimation)
  .get(getAllEstimations);

router.route("/:id")
  .put(updateEstimation)
  .delete(deleteEstimation);

module.exports = router;
