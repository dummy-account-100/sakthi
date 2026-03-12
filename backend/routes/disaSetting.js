const express = require("express");
const router = express.Router();

// 🔥 BULLETPROOF IMPORT
const db = require("../db");
const sql = db.sql || db; 

const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

// ══════════════════════════════════════════════════════════════════════════════
//  CUSTOM COLUMN MANAGEMENT  (Admin only)
// ══════════════════════════════════════════════════════════════════════════════

router.get("/custom-columns", async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT id, columnName, displayOrder
            FROM DISACustomColumns
            WHERE isDeleted = 0
            ORDER BY displayOrder ASC, id ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching custom columns:", err);
        res.status(500).json({ message: "DB error", error: err.message });
    }
});

router.post("/custom-columns", async (req, res) => {
    const { columnName } = req.body;
    if (!columnName || !columnName.trim()) {
        return res.status(400).json({ message: "Column name is required" });
    }
    try {
        const maxReq = new sql.Request();
        const maxRes = await maxReq.query(`SELECT ISNULL(MAX(displayOrder), 0) AS maxOrder FROM DISACustomColumns WHERE isDeleted = 0`);
        const nextOrder = maxRes.recordset[0].maxOrder + 1;
        
        const request = new sql.Request();
        request.input('columnName', sql.NVarChar, columnName.trim());
        request.input('displayOrder', sql.Int, nextOrder);
        
        const result = await request.query(`
            INSERT INTO DISACustomColumns (columnName, displayOrder, isDeleted)
            OUTPUT INSERTED.id, INSERTED.columnName, INSERTED.displayOrder
            VALUES (@columnName, @displayOrder, 0)
        `);
        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error adding custom column:", err);
        res.status(500).json({ message: "Insert failed", error: err.message });
    }
});

router.put("/custom-columns/:id", async (req, res) => {
    const { id } = req.params;
    const { columnName } = req.body;
    if (!columnName || !columnName.trim()) {
        return res.status(400).json({ message: "Column name is required" });
    }
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        request.input('columnName', sql.NVarChar, columnName.trim());
        await request.query(`UPDATE DISACustomColumns SET columnName = @columnName WHERE id = @id`);
        res.json({ message: "Custom column updated successfully" });
    } catch (err) {
        console.error("Error updating custom column:", err);
        res.status(500).json({ message: "Update failed", error: err.message });
    }
});

router.delete("/custom-columns/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        await request.query(`UPDATE DISACustomColumns SET isDeleted = 1 WHERE id = @id`);
        res.json({ message: "Custom column removed" });
    } catch (err) {
        console.error("Error deleting custom column:", err);
        res.status(500).json({ message: "Delete failed", error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  CORE RECORD ROUTES
// ══════════════════════════════════════════════════════════════════════════════

router.get("/last-mould-count", async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT TOP 1 mouldCountNo 
            FROM DISASettingAdjustmentRecord
            ORDER BY id DESC
        `);
        const prev = result.recordset.length > 0 ? result.recordset[0].mouldCountNo : 0;
        res.json({ prevMouldCountNo: prev });
    } catch (err) {
        console.error("Error fetching last mould count:", err);
        res.status(500).json({ message: "DB error", error: err.message });
    }
});

router.post("/add", async (req, res) => {
    const {
        recordDate, mouldCountNo, prevMouldCountNo, noOfMoulds,
        workCarriedOut, preventiveWorkCarried, remarks, customValues, operatorSignature
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('recordDate', sql.Date, recordDate);
        request.input('mouldCountNo', sql.VarChar, String(mouldCountNo));
        request.input('prevMouldCountNo', sql.VarChar, String(prevMouldCountNo));
        request.input('noOfMoulds', sql.Int, noOfMoulds);
        request.input('workCarriedOut', sql.NVarChar, workCarriedOut || '');
        request.input('preventiveWorkCarried', sql.NVarChar, preventiveWorkCarried || '');
        request.input('remarks', sql.NVarChar, remarks || '');
        request.input('operatorSignature', sql.NVarChar, operatorSignature || '');

        const insertResult = await request.query(`
            INSERT INTO DISASettingAdjustmentRecord (
                recordDate, mouldCountNo, prevMouldCountNo, noOfMoulds,
                workCarriedOut, preventiveWorkCarried, remarks, operatorSignature
            )
            OUTPUT INSERTED.id
            VALUES (
                @recordDate, @mouldCountNo, @prevMouldCountNo, @noOfMoulds,
                @workCarriedOut, @preventiveWorkCarried, @remarks, @operatorSignature
            )
        `);

        const newRecordId = insertResult.recordset[0].id;

        if (customValues && typeof customValues === 'object') {
            for (const [columnId, value] of Object.entries(customValues)) {
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    const colReq = new sql.Request();
                    colReq.input('recordId', sql.Int, newRecordId);
                    colReq.input('columnId', sql.Int, parseInt(columnId));
                    colReq.input('value', sql.NVarChar, String(value));
                    await colReq.query(`
                        INSERT INTO DISACustomColumnValues (recordId, columnId, value)
                        VALUES (@recordId, @columnId, @value)
                    `);
                }
            }
        }

        res.json({ message: "Record saved successfully", id: newRecordId });
    } catch (err) {
        console.error("Error inserting record:", err);
        res.status(500).json({ message: "Insert failed", error: err.message });
    }
});

// BULK EXPORT ROUTE
router.get("/records", async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const request = new sql.Request();

        let query = `
            SELECT id, recordDate, mouldCountNo, prevMouldCountNo, noOfMoulds,
                   workCarriedOut, preventiveWorkCarried, remarks, operatorSignature
            FROM DISASettingAdjustmentRecord
        `;
        
        if (fromDate && toDate) {
            query += ` WHERE recordDate BETWEEN @fromDate AND @toDate`;
            request.input('fromDate', sql.Date, fromDate);
            request.input('toDate', sql.Date, toDate);
        }
        query += ` ORDER BY id DESC`;

        const recordsResult = await request.query(query);
        const records = recordsResult.recordset;

        let qfHistory = [];
        try {
            const qfReq = new sql.Request();
            const qfRes = await qfReq.query(`SELECT qfValue, date FROM DISASettingAdjustmentQFvalues WHERE formName = 'disa-setting-adjustment' ORDER BY date DESC, id DESC`);
            qfHistory = qfRes.recordset;
        } catch(e) { console.error("Error fetching DISA Adjustment QF Values", e); }

        if (records.length === 0) return res.json({ records: [], qfHistory });

        let valMap = {};
        try {
            const ids = records.map(r => r.id).join(',');
            const valReq = new sql.Request();
            const valResult = await valReq.query(`
                SELECT recordId, columnId, value
                FROM DISACustomColumnValues
                WHERE recordId IN (${ids})
            `);

            valResult.recordset.forEach(v => {
                if (!valMap[v.recordId]) valMap[v.recordId] = {};
                valMap[v.recordId][v.columnId] = v.value;
            });
        } catch(e) {
            console.log("Custom columns table missing or empty, skipping custom values mapping.");
        }

        const merged = records.map(r => ({
            ...r,
            customValues: valMap[r.id] || {}
        }));

        res.json({ records: merged, qfHistory });
    } catch (err) {
        console.error("Error fetching records:", err);
        res.status(500).json({ message: "DB error", error: err.message });
    }
});

router.put("/records/:id", async (req, res) => {
    const { id } = req.params;
    const {
        recordDate, mouldCountNo, prevMouldCountNo, noOfMoulds,
        workCarriedOut, preventiveWorkCarried, remarks, customValues
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('id', sql.Int, id);
        request.input('recordDate', sql.Date, recordDate);
        request.input('mouldCountNo', sql.VarChar, String(mouldCountNo));
        request.input('prevMouldCountNo', sql.VarChar, String(prevMouldCountNo));
        request.input('noOfMoulds', sql.Int, noOfMoulds);
        request.input('workCarriedOut', sql.NVarChar, workCarriedOut || '');
        request.input('preventiveWorkCarried', sql.NVarChar, preventiveWorkCarried || '');
        request.input('remarks', sql.NVarChar, remarks || '');

        await request.query(`
            UPDATE DISASettingAdjustmentRecord
            SET recordDate = @recordDate, mouldCountNo = @mouldCountNo,
                prevMouldCountNo = @prevMouldCountNo, noOfMoulds = @noOfMoulds,
                workCarriedOut = @workCarriedOut, preventiveWorkCarried = @preventiveWorkCarried,
                remarks = @remarks
            WHERE id = @id
        `);

        if (customValues && typeof customValues === 'object') {
            for (const [columnId, value] of Object.entries(customValues)) {
                const colId = parseInt(columnId);
                const strVal = value !== null && value !== undefined ? String(value) : '';

                const checkReq = new sql.Request();
                checkReq.input('recordId', sql.Int, id);
                checkReq.input('columnId', sql.Int, colId);
                const existing = await checkReq.query(`SELECT id FROM DISACustomColumnValues WHERE recordId = @recordId AND columnId = @columnId`);

                const updateReq = new sql.Request();
                updateReq.input('recordId', sql.Int, id);
                updateReq.input('columnId', sql.Int, colId);
                updateReq.input('value', sql.NVarChar, strVal);

                if (existing.recordset.length > 0) {
                    await updateReq.query(`UPDATE DISACustomColumnValues SET value = @value WHERE recordId = @recordId AND columnId = @columnId`);
                } else {
                    await updateReq.query(`INSERT INTO DISACustomColumnValues (recordId, columnId, value) VALUES (@recordId, @columnId, @value)`);
                }
            }
        }

        res.json({ message: "Record updated successfully" });
    } catch (err) {
        console.error("Error updating record:", err);
        res.status(500).json({ message: "Update failed", error: err.message });
    }
});

router.delete("/records/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const req1 = new sql.Request();
        req1.input('id', sql.Int, id);
        await req1.query(`DELETE FROM DISACustomColumnValues WHERE recordId = @id`);

        const req2 = new sql.Request();
        req2.input('id', sql.Int, id);
        await req2.query(`DELETE FROM DISASettingAdjustmentRecord WHERE id = @id`);

        res.json({ message: "Record deleted successfully" });
    } catch (err) {
        console.error("Error deleting record:", err);
        res.status(500).json({ message: "Delete failed", error: err.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  PDF REPORT (OPERATOR VIEW) - UPDATED FOR DYNAMIC QF
// ══════════════════════════════════════════════════════════════════════════════
router.get("/report", async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT id, recordDate, mouldCountNo, noOfMoulds,
                   workCarriedOut, preventiveWorkCarried, remarks, operatorSignature
            FROM DISASettingAdjustmentRecord
            ORDER BY id DESC
        `);

        // 🔥 Fetch QF History
        let qfHistory = [];
        try {
            const qfReq = new sql.Request();
            const qfRes = await qfReq.query(`SELECT qfValue, date FROM DISASettingAdjustmentQFvalues WHERE formName = 'disa-setting-adjustment' ORDER BY date DESC, id DESC`);
            qfHistory = qfRes.recordset;
        } catch(e) {}

        let customCols = [];
        let customValMap = {};
        
        try {
            const colsReq = new sql.Request();
            const colsResult = await colsReq.query(`
                SELECT id, columnName FROM DISACustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC
            `);
            customCols = colsResult.recordset;

            if (customCols.length > 0) {
                const vReq = new sql.Request();
                const vRes = await vReq.query(`SELECT recordId, columnId, value FROM DISACustomColumnValues`);
                vRes.recordset.forEach(v => {
                    if (!customValMap[v.recordId]) customValMap[v.recordId] = {};
                    customValMap[v.recordId][v.columnId] = v.value;
                });
            }
        } catch (e) {}

        const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=DISA_Setting_Adjustment_Report.pdf");
        doc.pipe(res);

        const startX = 30;
        let startY = 30;
        const pageWidth = doc.page.width - 60; 

        const baseHeaders = ["Date", "Mould Count No.", "No. of Moulds", "Work Carried Out", "Preventive Work Carried", "Signature", "Remarks"];
        const headers = [...baseHeaders, ...customCols.map(c => c.columnName)];

        const baseWeights = [1.2, 1.5, 1.2, 3, 3, 2, 1.5]; 
        const customWeights = customCols.map(() => 1.5); 

        const allWeights = [...baseWeights, ...customWeights];
        const totalWeight = allWeights.reduce((sum, w) => sum + w, 0);
        const colWidths = allWeights.map(w => (w / totalWeight) * pageWidth);

        const minRowHeight = 45; 
        const headerFontSize = headers.length > 8 ? 7 : 9;
        const bodyFontSize = headers.length > 8 ? 7 : 9;

        const drawHeaders = (y) => {
            const logoBoxWidth = 100;
            const titleBoxWidth = pageWidth - logoBoxWidth;
            const headerHeight = 40;

            doc.lineWidth(1);
            
            doc.rect(startX, y, logoBoxWidth, headerHeight).stroke();
            const logoPath = path.join(__dirname, "logo.jpg");
            
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 10, y + 5, {
                    width: 80, height: 30, fit: [80, 30], align: 'center', valign: 'center'
                });
            } else {
                doc.font("Helvetica-Bold").fontSize(12).text("SAKTHI\nAUTO", startX, y + 10, { width: logoBoxWidth, align: "center" });
            }

            doc.rect(startX + logoBoxWidth, y, titleBoxWidth, headerHeight).stroke();
            doc.font("Helvetica-Bold").fontSize(18);
            doc.text("DISA SETTING ADJUSTMENT RECORD", startX + logoBoxWidth, y + 14, {
                width: titleBoxWidth, align: "center"
            });

            const tableHeaderY = y + headerHeight;
            let currentX = startX;
            doc.font("Helvetica-Bold").fontSize(headerFontSize);
            headers.forEach((header, i) => {
                doc.rect(currentX, tableHeaderY, colWidths[i], minRowHeight).stroke();
                doc.text(header, currentX + 3, tableHeaderY + 10, {
                    width: colWidths[i] - 6, align: "center"
                });
                currentX += colWidths[i];
            });
            return tableHeaderY + minRowHeight;
        };

        const drawFooter = (yPos, qfString) => {
            const footerY = doc.page.height - 40; 
            doc.font("Helvetica").fontSize(8);
            doc.text(qfString, startX, footerY, { align: "left" });
        };

        const processText = (text) => {
            if (!text) return "";
            if (text.includes(",") && !text.includes("•")) {
                return text.split(",").map(item => `• ${item.trim()}`).join("\n");
            }
            return text;
        };

        // 🔥 FIX: ALWAYS USE THE MOST RECENT QF VALUE REGARDLESS OF DATE
        const dynamicQfString = (qfHistory && qfHistory.length > 0) 
            ? qfHistory[0].qfValue 
            : "QF/07/FBP-02, Rev. No.01 Dt 14.05.2025";

        let y = drawHeaders(startY);

        result.recordset.forEach((row) => {
            const formattedDate = new Date(row.recordDate).toLocaleDateString("en-GB");
            const customData = customCols.map(c => customValMap[row.id]?.[c.id] || "");
            
            const rowData = [
                formattedDate, row.mouldCountNo, row.noOfMoulds,
                processText(row.workCarriedOut), processText(row.preventiveWorkCarried),
                row.operatorSignature, 
                row.remarks || "", ...customData
            ];

            let maxRowHeight = minRowHeight;
            doc.font("Helvetica").fontSize(bodyFontSize);
            
            rowData.forEach((cell, i) => {
                if (i === 5) return; 
                const h = doc.heightOfString(String(cell || ""), { width: colWidths[i] - 6 });
                if (h + 20 > maxRowHeight) maxRowHeight = h + 20;
            });

            if (y + maxRowHeight > doc.page.height - 70) {
                drawFooter(y, dynamicQfString);
                doc.addPage({ size: "A4", layout: "landscape", margin: 30 }); 
                y = drawHeaders(30);
            }

            let x = startX;
            rowData.forEach((cell, i) => {
                doc.rect(x, y, colWidths[i], maxRowHeight).stroke();
                
                if (i === 5 && cell && cell.startsWith("data:image")) {
                    try {
                        doc.image(cell, x + 5, y + 5, {
                            fit: [colWidths[i] - 10, maxRowHeight - 10],
                            align: 'center', valign: 'center'
                        });
                    } catch (imgErr) {
                        doc.text("Invalid Sig", x + 5, y + 10, { width: colWidths[i] - 10, align: "center" });
                    }
                } else if (i !== 5) {
                    doc.text(String(cell || ""), x + 3, y + 10, { width: colWidths[i] - 6, align: "center" });
                }
                
                x += colWidths[i];
            });
            y += maxRowHeight;
        });

        drawFooter(y, dynamicQfString);
        doc.end();
    } catch (err) {
        console.error("Error generating DISA report:", err);
        res.status(500).json({ message: "Report generation failed" });
    }
});

module.exports = router;