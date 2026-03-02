const express = require("express");
const router = express.Router();
const controller = require("../controllers/errorProofController");
const sql = require("../db");

// ✅ ADD THIS (YOU ARE MISSING IT)
router.post("/save", controller.saveDetails);

router.get("/details", controller.getDetails);
router.get("/report", controller.generateReport);
router.get("/hof/:name", controller.getHofReports);
router.post("/sign-hof", controller.signHof);
router.get("/supervisor/:name", controller.getSupervisorReports);
router.post("/sign-supervisor", controller.signSupervisor);

// ── Admin: Fetch error proof records for a specific date and machine ───────────
router.get("/details-by-date", async (req, res) => {
    try {
        const { date, machine } = req.query;
        if (!date || !machine) return res.status(400).json({ message: "date and machine required" });

        const request = new sql.Request();
        request.input('date', sql.Date, date);
        request.input('machine', sql.VarChar, machine);

        const verificationResult = await request.query(`
            SELECT * FROM ErrorProofVerifications 
            WHERE FORMAT(RecordDate, 'yyyy-MM-dd') = @date AND DisaMachine = @machine
            ORDER BY Id ASC
        `);

        const verifications = verificationResult.recordset;
        const hofsRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'hof' ORDER BY username`;
        const operatorsRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'operator' ORDER BY username`;
        const supervisorsRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'supervisor' ORDER BY username`;

        let reactionPlans = [];
        if (verifications.length > 0) {
            const ids = verifications.map(v => v.Id).join(',');
            const reactionRes = await sql.query(`SELECT * FROM ReactionPlans WHERE VerificationId IN (${ids}) ORDER BY SNo ASC`);
            reactionPlans = reactionRes.recordset;
        }

        res.json({
            verifications,
            reactionPlans,
            hofs: hofsRes.recordset,
            operators: operatorsRes.recordset,
            supervisors: supervisorsRes.recordset
        });
    } catch (err) {
        console.error("Error fetching error proof by date:", err);
        res.status(500).json({ message: "DB error", error: err.message });
    }
});

module.exports = router;