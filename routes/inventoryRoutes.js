const express = require('express');
const router = express.Router();
const {
  getAll, create, remove, updateCash,
  getAllAdjustments, createAdjustment, updateAdjustment, deleteAdjustment,
  getAllSales, createSale, updateSale, deleteSale, getNextSaleNo,
  getAllPurchases, createPurchase, updatePurchase, deletePurchase, getNextPurchaseNo,
  getStockList, createStockItem, updateStockItem, deleteStockItem
} = require('../controllers/inventoryController');

// Cash Entries
router.get('/cash', getAll);
router.post('/cash', create);
router.put('/cash/:id', updateCash);
router.delete('/cash/:id', remove);

// Adjustments
router.get('/adjustments', getAllAdjustments);
router.post('/adjustments', createAdjustment);
router.put('/adjustments/:id', updateAdjustment);
router.delete('/adjustments/:id', deleteAdjustment);

// Sales
router.get('/sales/next-number', getNextSaleNo);
router.get('/sales', getAllSales);
router.post('/sales', createSale);
router.put('/sales/:id', updateSale);
router.delete('/sales/:id', deleteSale);

// Purchases
router.get('/purchases/next-number', getNextPurchaseNo);
router.get('/purchases', getAllPurchases);
router.post('/purchases', createPurchase);
router.put('/purchases/:id', updatePurchase);
router.delete('/purchases/:id', deletePurchase);

// Stock
router.get('/stock', getStockList);
router.post('/stock', createStockItem);
router.put('/stock/:id', updateStockItem);
router.delete('/stock/:id', deleteStockItem);

module.exports = router;
