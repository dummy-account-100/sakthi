const sql = require("../db");

// ==========================================
//      ADMIN: MANAGE FORM SETTINGS (QF VALUES)
// ==========================================
exports.getFormSettings = async (req, res) => {
    try {
        // Fetch ONLY the latest stored QF value for BOTH forms to display in the UI
        const result = await sql.query`
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date,
                       ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM DisamaticReportQFvalues
            ) t1 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date,
                       ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM PerformanceReportQFvalues
            ) t2 WHERE rn = 1
            ORDER BY formName ASC
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error("getFormSettings error:", err);
        res.status(500).json({ error: "Failed to fetch form settings", details: err.message });
    }
};

exports.updateFormSettings = async (req, res) => {
    const { setting } = req.body; 

    if (!setting) {
        return res.status(400).json({ error: "No setting data provided" });
    }

    const safeDate = (setting.date && setting.date.trim() !== '') ? setting.date : null;

    try {
        // Route to the correct table based on formName
        if (setting.formName === 'performance') {
            await sql.query`
                INSERT INTO PerformanceReportQFvalues (formName, qfValue, date)
                VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})
            `;
        } else {
            await sql.query`
                INSERT INTO DisamaticReportQFvalues (formName, qfValue, date)
                VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})
            `;
        }
        
        res.json({ message: "New QF value record created successfully" });
    } catch (err) {
        console.error("updateFormSettings error:", err);
        res.status(500).json({ error: "Failed to save new form setting", details: err.message });
    }
};