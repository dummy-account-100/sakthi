const express = require("express");
const router = express.Router();
const dailyPerformanceController = require("../controllers/dailyPerformanceController");

// ==========================================
//  AUTO-CALCULATION & DATA FETCHING ROUTES
// ==========================================
// Fetches aggregated summary data by date and DISA line
router.get("/daily-performance/summary", dailyPerformanceController.getSummaryByDate);

// Fetches delays by date and DISA line
router.get("/daily-performance/delays", dailyPerformanceController.getDelaysByDateAndDisa);

// Fetches total produced/poured counts for a specific component
router.get("/daily-performance/component-totals", dailyPerformanceController.getComponentTotals);

// Fetches users for form dropdowns (Incharges, HOFs, HODs)
router.get("/daily-performance/users", dailyPerformanceController.getFormUsers);

// 🔥 FIXED: Added /daily-performance to match the frontend URL
router.get("/daily-performance/supervisor/:name", dailyPerformanceController.getSupervisorReports);


// ==========================================
//  HOF & HOD DASHBOARD ROUTES
// ==========================================
// HOF Routes
router.get("/daily-performance/hof/:name", dailyPerformanceController.getHofReports);
router.post("/daily-performance/sign-hof", dailyPerformanceController.signHof);

// HOD Routes
router.get("/daily-performance/hod/:name", dailyPerformanceController.getHodReports);
router.post("/daily-performance/sign-hod", dailyPerformanceController.signHod);


// ==========================================
//  ADMIN / MANAGEMENT ROUTES
// ==========================================
// Admin: Fetch report by exact date & DISA (for Edit/View)
router.get("/daily-performance/by-date", dailyPerformanceController.getByDate);

// Admin: Update a report by ID
router.put("/daily-performance/:id", dailyPerformanceController.updateReport);

// 🔥 FIXED: Added /daily-performance to match the frontend URL
router.post("/daily-performance/sign-supervisor", dailyPerformanceController.signSupervisor);


// ==========================================
//  CORE FUNCTIONALITY ROUTES
// ==========================================
// PDF Download Route (Handles both Single Report and Bulk Range PDFs)
router.get("/daily-performance/download-pdf", dailyPerformanceController.downloadPDF);

// Post Route for submitting the Daily Performance Report
router.post("/daily-performance", dailyPerformanceController.createDailyPerformance);

module.exports = router;