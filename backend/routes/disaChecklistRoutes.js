const express = require('express');
const router = express.Router();
const controller = require('../controllers/disaMachineChecklistController');

// Operator & PDF Routes
router.get('/details', controller.getChecklistDetails);
router.get('/monthly-report', controller.getMonthlyReport); 
router.post('/report-nc', controller.saveNCReport);
router.post('/submit-batch', controller.saveBatchChecklist);

// HOD Dashboard Routes
router.get('/hod/:name', controller.getReportsByHOD);
router.post('/sign', controller.signReportByHOD);

// ADMIN PDF EXPORT:
router.get('/bulk-data', controller.getBulkData);

// 🔥 ADD THESE TWO NEW ROUTES FOR SUPERVISOR NCR:
router.get('/supervisor-ncr/:name', controller.getNcrReportsBySupervisor);
router.post('/sign-ncr', controller.signNcrBySupervisor);

module.exports = router;