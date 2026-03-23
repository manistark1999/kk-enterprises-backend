const express = require("express");
const router = express.Router();
const {
  createPayment,
  getAllPayments,
  updatePayment,
  deletePayment,
  getNextPaymentNo
} = require("../controllers/paymentController");

router.get("/next-number", getNextPaymentNo);

router.route("/")
  .get(getAllPayments)
  .post(createPayment);

router.route("/:id")
  .put(updatePayment)
  .delete(deletePayment);

module.exports = router;
