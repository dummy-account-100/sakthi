const express = require('express');
const router = express.Router();
const mouldController = require('../controllers/mouldController');

router.get('/details', mouldController.getMouldDetails);
router.post('/save', mouldController.saveMouldDetails);
router.get('/bulk-data', mouldController.getBulkData);

// 🔥 NEW: Routes for the Summary Data (Fixes the 404)
router.get('/summary', mouldController.getSummaryData);
router.post('/summary', mouldController.saveSummaryData);

// 🔥 ADD THIS LINE to handle the summary fetch and stop the 404


module.exports = router;