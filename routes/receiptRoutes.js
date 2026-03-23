const express = require("express");
const router = express.Router();
const {
  createReceipt,
  getAllReceipts,
  updateReceipt,
  deleteReceipt,
  getNextReceiptNo
} = require("../controllers/receiptController");

router.get("/next-number", getNextReceiptNo);

router.route("/")
  .get(getAllReceipts)
  .post(createReceipt);

router.route("/:id")
  .put(updateReceipt)
  .delete(deleteReceipt);

module.exports = router;
