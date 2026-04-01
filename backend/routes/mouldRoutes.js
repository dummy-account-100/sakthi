const express = require('express');
const router = express.Router();
const mouldController = require('../controllers/mouldController');

router.get('/details', mouldController.getMouldDetails);
router.post('/save', mouldController.saveMouldDetails);
router.get('/bulk-data', mouldController.getBulkData);

router.get('/summary', mouldController.getSummaryData);
router.post('/summary', mouldController.saveSummaryData);

// 🔥 NEW: Routes for the HOF Assignment and Verification Dashboard
router.get('/hof-reports/:name', mouldController.getReportsByHOF);
router.post('/hof-sign', mouldController.signReportByHOF);

module.exports = router;