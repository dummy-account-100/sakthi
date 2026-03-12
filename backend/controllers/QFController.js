const sql = require("../db");

// ==========================================
//      ADMIN: MANAGE FORM SETTINGS (QF VALUES)
// ==========================================
exports.getFormSettings = async (req, res) => {
    try {
        // Fetch ONLY the latest stored QF value for each form to display in the UI
        const result = await sql.query`
            SELECT id, formName, qfValue, date 
            FROM (
                SELECT id, formName, qfValue, date,
                       ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM DisamaticReportQFvalues
            ) t
            WHERE rn = 1
            ORDER BY formName ASC
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error("getFormSettings error:", err);
        res.status(500).json({ error: "Failed to fetch form settings", details: err.message });
    }
};

exports.updateFormSettings = async (req, res) => {
    // Safely extract the single setting sent from the frontend
    const { setting } = req.body; 

    if (!setting) {
        return res.status(400).json({ error: "No setting data provided" });
    }

    // 🔥 FIX: Ensure empty string dates are passed strictly as NULL to avoid SQL cast errors
    const safeDate = (setting.date && setting.date.trim() !== '') ? setting.date : null;

    try {
        // INSERT a completely new record to keep historical tracking
        await sql.query`
            INSERT INTO DisamaticReportQFvalues (formName, qfValue, date)
            VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})
        `;
        
        res.json({ message: "New QF value record created successfully" });
    } catch (err) {
        console.error("updateFormSettings error:", err);
        res.status(500).json({ error: "Failed to save new form setting", details: err.message });
    }
};