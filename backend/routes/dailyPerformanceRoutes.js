const express = require("express");
const router = express.Router();
const dailyPerformanceController = require("../controllers/dailyPerformanceController");

// Get Routes for auto-calculations
router.get("/daily-performance/summary", dailyPerformanceController.getSummaryByDate);
router.get("/daily-performance/delays", dailyPerformanceController.getDelaysByDateAndDisa);

// HOF Routes
router.get("/daily-performance/hof/:name", dailyPerformanceController.getHofReports);
router.post("/daily-performance/sign-hof", dailyPerformanceController.signHof);

// HOD Routes
router.get("/daily-performance/hod/:name", dailyPerformanceController.getHodReports);
router.post("/daily-performance/sign-hod", dailyPerformanceController.signHod);

router.get("/daily-performance/users", dailyPerformanceController.getFormUsers);

// ── Admin: Bulk Export PDF (date range) ──────────────────────────────────────
router.get("/daily-performance/bulk-data", dailyPerformanceController.getBulkData);

// ── Admin: Fetch report by exact date & disa (for edit) ──────────────────────
router.get("/daily-performance/by-date", dailyPerformanceController.getByDate);

// ── Admin: Update a report by ID ──────────────────────────────────────────────
router.put("/daily-performance/:id", dailyPerformanceController.updateReport);

// ⬇️ PDF DOWNLOAD ⬇️
router.get("/daily-performance/download-pdf", dailyPerformanceController.downloadPDF);

// Post Route for submitting the form
router.post("/daily-performance", dailyPerformanceController.createDailyPerformance);

module.exports = router;
