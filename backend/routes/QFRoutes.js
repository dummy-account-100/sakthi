const express = require("express");
const router = express.Router();
const qfController = require("../controllers/QFController");

// --- FORM SETTINGS (QF VALUES) ROUTES ---
router.get("/qf-values", qfController.getFormSettings);
router.put("/qf-values", qfController.updateFormSettings);

module.exports = router;