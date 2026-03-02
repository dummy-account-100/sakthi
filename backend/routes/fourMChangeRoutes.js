const express = require("express");
const router = express.Router();
const sql = require("../db"); // Adjusted to safe import
const PDFDocument = require("pdfkit");
const path = require("path");

// ══════════════════════════════════════════════════════════════════════════════
//  DROPDOWN DATA
// ══════════════════════════════════════════════════════════════════════════════
router.get("/incharges", async (req, res) => {
    try {
        const supRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'supervisor' ORDER BY username ASC`;
        const hodRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'hod' ORDER BY username ASC`;
        res.json({ supervisors: supRes.recordset, hods: hodRes.recordset });
    } catch (err) { res.status(500).json({ message: "DB error", error: err.message }); }
});

router.get("/types", async (req, res) => {
    try {
        const result = await sql.query`SELECT typeName FROM FourMTypes ORDER BY id ASC`;
        res.json(result.recordset);
    } catch (err) {
        res.json([{ typeName: "Man" }, { typeName: "Machine" }, { typeName: "Material" }, { typeName: "Method" }]);
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  CUSTOM COLUMN MANAGEMENT (Admin)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/custom-columns", async (req, res) => {
    try {
        const result = await sql.query(`SELECT id, columnName, displayOrder FROM FourMCustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error", error: err.message }); }
});

router.post("/custom-columns", async (req, res) => {
    const { columnName } = req.body;
    try {
        const maxRes = await sql.query(`SELECT ISNULL(MAX(displayOrder), 0) AS maxOrder FROM FourMCustomColumns WHERE isDeleted = 0`);
        const nextOrder = maxRes.recordset[0].maxOrder + 1;

        const request = new sql.Request();
        request.input('columnName', sql.NVarChar, columnName.trim());
        request.input('displayOrder', sql.Int, nextOrder);
        const result = await request.query(`INSERT INTO FourMCustomColumns (columnName, displayOrder, isDeleted) OUTPUT INSERTED.* VALUES (@columnName, @displayOrder, 0)`);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ message: "Insert failed", error: err.message }); }
});

router.put("/custom-columns/:id", async (req, res) => {
    const { id } = req.params;
    const { columnName } = req.body;
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, id).input('columnName', sql.NVarChar, columnName.trim());
        await request.query(`UPDATE FourMCustomColumns SET columnName = @columnName WHERE id = @id`);
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ message: "Update failed", error: err.message }); }
});

router.delete("/custom-columns/:id", async (req, res) => {
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, req.params.id);
        await request.query(`UPDATE FourMCustomColumns SET isDeleted = 1 WHERE id = @id`);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ message: "Delete failed" }); }
});

// ══════════════════════════════════════════════════════════════════════════════
//  RECORDS CRUD
// ══════════════════════════════════════════════════════════════════════════════
router.get("/records", async (req, res) => {
    try {
        const recordsResult = await sql.query(`SELECT * FROM FourMChangeRecord ORDER BY id DESC`);
        const records = recordsResult.recordset;

        if (records.length === 0) return res.json([]);

        const ids = records.map(r => r.id).join(',');
        const valResult = await sql.query(`SELECT recordId, columnId, value FROM FourMCustomColumnValues WHERE recordId IN (${ids})`);

        const valMap = {};
        valResult.recordset.forEach(v => {
            if (!valMap[v.recordId]) valMap[v.recordId] = {};
            valMap[v.recordId][v.columnId] = v.value;
        });

        res.json(records.map(r => ({ ...r, customValues: valMap[r.id] || {} })));
    } catch (err) { res.status(500).json({ message: "DB error", error: err.message }); }
});

// ── Admin: Fetch records by single date ───────────────────────────────────────
router.get("/records-by-date", async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: "date query param required" });

        const request = new sql.Request();
        request.input('date', sql.Date, date);
        const recordsResult = await request.query(`SELECT * FROM FourMChangeRecord WHERE recordDate = @date ORDER BY id ASC`);
        const records = recordsResult.recordset;

        if (records.length === 0) return res.json([]);

        const ids = records.map(r => r.id).join(',');
        const valResult = await sql.query(`SELECT recordId, columnId, value FROM FourMCustomColumnValues WHERE recordId IN (${ids})`);
        const customCols = await sql.query(`SELECT id, columnName FROM FourMCustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC`);

        const valMap = {};
        valResult.recordset.forEach(v => {
            if (!valMap[v.recordId]) valMap[v.recordId] = {};
            valMap[v.recordId][v.columnId] = v.value;
        });

        res.json({
            records: records.map(r => ({ ...r, customValues: valMap[r.id] || {} })),
            customColumns: customCols.recordset
        });
    } catch (err) {
        console.error("Error fetching 4M records by date:", err);
        res.status(500).json({ message: "DB error", error: err.message });
    }
});

// ── Admin: Update a single 4M record ─────────────────────────────────────────
router.put("/records/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            line, partName, recordDate, shift, mcNo, type4M, description,
            firstPart, lastPart, inspFreq, retroChecking, quarantine,
            partId, internalComm, inchargeSign, assignedHOD, customValues
        } = req.body;

        const request = new sql.Request();
        request.input('id', sql.Int, id)
            .input('line', sql.VarChar, line || '').input('partName', sql.VarChar, partName || '')
            .input('recordDate', sql.Date, recordDate).input('shift', sql.VarChar, shift || '')
            .input('mcNo', sql.VarChar, mcNo || '').input('type4M', sql.VarChar, type4M || '')
            .input('description', sql.NVarChar, description || '').input('firstPart', sql.VarChar, firstPart || '')
            .input('lastPart', sql.VarChar, lastPart || '').input('inspFreq', sql.VarChar, inspFreq || '')
            .input('retroChecking', sql.VarChar, retroChecking || '').input('quarantine', sql.VarChar, quarantine || '')
            .input('partId', sql.VarChar, partId || '').input('internalComm', sql.VarChar, internalComm || '')
            .input('inchargeSign', sql.VarChar, inchargeSign || '').input('assignedHOD', sql.VarChar, assignedHOD || '');

        await request.query(`
            UPDATE FourMChangeRecord SET
                line=@line, partName=@partName, recordDate=@recordDate, shift=@shift,
                mcNo=@mcNo, type4M=@type4M, description=@description, firstPart=@firstPart,
                lastPart=@lastPart, inspFreq=@inspFreq, retroChecking=@retroChecking,
                quarantine=@quarantine, partId=@partId, internalComm=@internalComm,
                inchargeSign=@inchargeSign, AssignedHOD=@assignedHOD
            WHERE id=@id
        `);

        if (customValues && typeof customValues === 'object') {
            for (const [columnId, value] of Object.entries(customValues)) {
                const colId = parseInt(columnId);
                const strVal = value !== null && value !== undefined ? String(value) : '';
                const checkReq = new sql.Request();
                checkReq.input('recordId', sql.Int, id).input('columnId', sql.Int, colId);
                const existing = await checkReq.query(`SELECT id FROM FourMCustomColumnValues WHERE recordId=@recordId AND columnId=@columnId`);
                const upReq = new sql.Request();
                upReq.input('recordId', sql.Int, id).input('columnId', sql.Int, colId).input('value', sql.NVarChar, strVal);
                if (existing.recordset.length > 0) {
                    await upReq.query(`UPDATE FourMCustomColumnValues SET value=@value WHERE recordId=@recordId AND columnId=@columnId`);
                } else {
                    await upReq.query(`INSERT INTO FourMCustomColumnValues (recordId, columnId, value) VALUES (@recordId, @columnId, @value)`);
                }
            }
        }
        res.json({ message: "Record updated successfully" });
    } catch (err) {
        console.error("Error updating 4M record:", err);
        res.status(500).json({ message: "Update failed", error: err.message });
    }
});

router.post("/add", async (req, res) => {
    const {
        line, partName, recordDate, shift, mcNo, type4M, description,
        firstPart, lastPart, inspFreq, retroChecking, quarantine,
        partId, internalComm, inchargeSign, assignedHOD, customValues
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('line', sql.VarChar, line).input('partName', sql.VarChar, partName).input('recordDate', sql.Date, recordDate)
            .input('shift', sql.VarChar, shift).input('mcNo', sql.VarChar, mcNo).input('type4M', sql.VarChar, type4M)
            .input('description', sql.NVarChar, description).input('firstPart', sql.VarChar, firstPart)
            .input('lastPart', sql.VarChar, lastPart).input('inspFreq', sql.VarChar, inspFreq)
            .input('retroChecking', sql.VarChar, retroChecking).input('quarantine', sql.VarChar, quarantine)
            .input('partId', sql.VarChar, partId).input('internalComm', sql.VarChar, internalComm)
            .input('inchargeSign', sql.VarChar, inchargeSign).input('assignedHOD', sql.VarChar, assignedHOD);

        const insertResult = await request.query(`
            INSERT INTO FourMChangeRecord (
              line, partName, recordDate, shift, mcNo, type4M, description, firstPart, lastPart, 
              inspFreq, retroChecking, quarantine, partId, internalComm, inchargeSign, AssignedHOD
            ) OUTPUT INSERTED.id VALUES (
              @line, @partName, @recordDate, @shift, @mcNo, @type4M, @description, @firstPart, @lastPart, 
              @inspFreq, @retroChecking, @quarantine, @partId, @internalComm, @inchargeSign, @assignedHOD
            )
        `);

        const newRecordId = insertResult.recordset[0].id;

        if (customValues && typeof customValues === 'object') {
            for (const [columnId, value] of Object.entries(customValues)) {
                if (value !== undefined && value !== null && String(value).trim() !== "") {
                    const colReq = new sql.Request();
                    colReq.input('recordId', sql.Int, newRecordId).input('columnId', sql.Int, parseInt(columnId)).input('value', sql.NVarChar, String(value));
                    await colReq.query(`INSERT INTO FourMCustomColumnValues (recordId, columnId, value) VALUES (@recordId, @columnId, @value)`);
                }
            }
        }
        res.json({ message: "Saved" });
    } catch (err) { res.status(500).json({ message: "Insert failed", error: err.message }); }
});

// SIGNATURE ROUTES
router.get("/supervisor/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const result = await sql.query`SELECT * FROM FourMChangeRecord WHERE inchargeSign = ${name} ORDER BY recordDate DESC, shift ASC`;
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
router.post("/sign-supervisor", async (req, res) => {
    try {
        const { reportId, signature } = req.body;
        await sql.query`UPDATE FourMChangeRecord SET SupervisorSignature = ${signature} WHERE id = ${reportId}`;
        res.json({ message: "Signature saved" });
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
router.get("/hod/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const result = await sql.query`SELECT * FROM FourMChangeRecord WHERE AssignedHOD = ${name} ORDER BY recordDate DESC, shift ASC`;
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
router.post("/sign-hod", async (req, res) => {
    try {
        const { reportId, signature } = req.body;
        await sql.query`UPDATE FourMChangeRecord SET HODSignature = ${signature} WHERE id = ${reportId}`;
        res.json({ message: "Signature saved" });
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});

// ══════════════════════════════════════════════════════════════════════════════
//  DYNAMIC PDF REPORT (Filtered by Date & Alignment Fixed)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/report", async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;

        const request = new sql.Request();
        let queryStr = `SELECT * FROM FourMChangeRecord`;

        if (fromDate && toDate) {
            queryStr += ` WHERE recordDate >= @fromDate AND recordDate <= @toDate`;
            request.input('fromDate', sql.Date, fromDate);
            request.input('toDate', sql.Date, toDate);
        }
        queryStr += ` ORDER BY id DESC`;

        const result = await request.query(queryStr);

        let customCols = [];
        let customValMap = {};
        try {
            const colsResult = await sql.query(`SELECT id, columnName FROM FourMCustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC`);
            customCols = colsResult.recordset;

            if (customCols.length > 0) {
                const vRes = await sql.query(`SELECT recordId, columnId, value FROM FourMCustomColumnValues`);
                vRes.recordset.forEach(v => {
                    if (!customValMap[v.recordId]) customValMap[v.recordId] = {};
                    customValMap[v.recordId][v.columnId] = v.value;
                });
            }
        } catch (e) { }

        const marginOptions = { top: 30, bottom: 20, left: 30, right: 30 };
        const doc = new PDFDocument({ margins: marginOptions, size: "A4", layout: "landscape" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=4M_Change_Report.pdf");
        doc.pipe(res);

        const topRecord = result.recordset.length > 0 ? result.recordset[0] : {};
        const headerLine = topRecord.line || "DISA - I";
        const hodSignature = topRecord.HODSignature;

        const uniquePartNames = [...new Set(result.recordset.map(row => row.partName).filter(name => name && name.trim() !== ""))];
        const headerPart = uniquePartNames.join(", ");

        const startX = 30;
        const pageWidth = doc.page.width - 60;

        const baseHeaders = ["Date /\nShift", "M/c.\nNo", "Type of\n4M", "Description", "First\nPart", "Last\nPart", "Insp.\nFreq", "Retro\nChecking", "Quarantine", "Part\nIdent.", "Internal\nComm.", "Supervisor\nSign"];
        const headers = [...baseHeaders, ...customCols.map(c => c.columnName)];

        const baseWeights = [1.5, 1, 1, 3.5, 1, 1, 1, 1.2, 1.5, 1, 1.2, 2.5];
        const customWeights = customCols.map(() => 1.5);
        const allWeights = [...baseWeights, ...customWeights];
        const totalWeight = allWeights.reduce((sum, w) => sum + w, 0);
        const colWidths = allWeights.map(w => (w / totalWeight) * pageWidth);

        const headerFontSize = headers.length > 12 ? 6.5 : 8;
        const bodyFontSize = headers.length > 12 ? 7 : 8.5;
        const minRowHeight = 40;

        const drawHeaders = (y) => {
            doc.font("Helvetica-Bold").fontSize(16).text("4M CHANGE MONITORING CHECK SHEET", startX, y, { align: "center" });
            doc.font("Helvetica-Bold").fontSize(12)
                .text(`Line: ${headerLine}`, startX, y + 25)
                .text(`Part Name: ${headerPart}`, startX, y + 25, { align: "right", width: pageWidth });

            if (fromDate && toDate) {
                doc.font("Helvetica").fontSize(9).text(`Filtered: ${fromDate} to ${toDate}`, startX, y + 38, { align: "center" });
            }

            const tableHeaderY = y + 50;
            let currentX = startX;
            doc.font("Helvetica-Bold").fontSize(headerFontSize);
            headers.forEach((header, i) => {
                doc.rect(currentX, tableHeaderY, colWidths[i], minRowHeight).stroke();
                doc.text(header, currentX, tableHeaderY + 8, { width: colWidths[i], align: "center" });
                currentX += colWidths[i];
            });
            return tableHeaderY + minRowHeight;
        };

        const drawFooter = () => {
            const footerY = doc.page.height - 35;
            doc.font("Helvetica").fontSize(8).text("QF/07/MPD-36, Rev. No: 01, 13.03.2019", startX, footerY, { align: "left" });
            const rightX = doc.page.width - 130;
            doc.text("HOD Sign", rightX, footerY, { align: "right" });

            if (hodSignature && hodSignature.startsWith('data:image')) {
                try {
                    const base64Data = hodSignature.split('base64,')[1];
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    doc.image(imgBuffer, rightX + 20, footerY - 15, { fit: [80, 25] });
                } catch (e) { }
            } else {
                doc.moveTo(rightX + 20, footerY - 5).lineTo(rightX + 100, footerY - 5).stroke();
            }
        };

        const drawCellContent = (value, x, y, width, height, isSignature = false) => {
            const centerX = x + width / 2;
            const centerY = y + (height / 2);

            // 🔥 FIXED: Draws Supervisor Signature perfectly
            if (isSignature && value && value.startsWith('data:image')) {
                try {
                    const base64Data = value.split('base64,')[1];
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    doc.image(imgBuffer, x + 2, y + 2, { fit: [width - 4, height - 4], align: 'center', valign: 'center' });
                } catch (e) { doc.font("Helvetica").fontSize(8).text("Invalid Sig", x, y + 10, { width, align: "center" }); }
            } else if (value === "OK") {
                doc.save().lineWidth(1.5).moveTo(centerX - 4, centerY + 2).lineTo(centerX - 1, centerY + 6).lineTo(centerX + 6, centerY - 4).stroke().restore();
            } else if (value === "Not OK") {
                doc.save().lineWidth(1.5).moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4).moveTo(centerX + 4, centerY - 4).lineTo(centerX - 4, centerY + 4).stroke().restore();
            } else if (["-", "N", "I"].includes(value)) {
                doc.font("Helvetica").fontSize(10).text(value, x, y + (height / 2) - 5, { width, align: "center" });
            } else {
                doc.font("Helvetica").fontSize(bodyFontSize).text(String(value || ""), x + 2, y + 5, { width: width - 4, align: "center" });
            }
        };

        let y = drawHeaders(30);

        if (result.recordset.length === 0) {
            doc.font("Helvetica-Oblique").fontSize(12).text("No records found for selected dates.", startX, y + 20, { align: "center", width: pageWidth });
        } else {
            result.recordset.forEach((row) => {
                const formattedDate = new Date(row.recordDate).toLocaleDateString("en-GB");
                const customData = customCols.map(c => customValMap[row.id]?.[c.id] || "");

                // Pass SupervisorSignature if it exists, otherwise pass the text name fallback
                const signatureCell = row.SupervisorSignature || row.inchargeSign;

                const rowData = [
                    `${formattedDate}\nShift ${row.shift}`, row.mcNo, row.type4M, row.description,
                    row.firstPart, row.lastPart, row.inspFreq, row.retroChecking,
                    row.quarantine, row.partId, row.internalComm, signatureCell, ...customData
                ];

                let maxRowHeight = minRowHeight;
                doc.font("Helvetica").fontSize(bodyFontSize);

                rowData.forEach((cell, i) => {
                    if (!["OK", "Not OK"].includes(cell) && i !== 11) { // Skip image height calculation
                        const h = doc.heightOfString(String(cell || ""), { width: colWidths[i] - 4 });
                        if (h + 15 > maxRowHeight) maxRowHeight = h + 15;
                    }
                });

                if (y + maxRowHeight > doc.page.height - 65) {
                    drawFooter();
                    doc.addPage({ size: "A4", layout: "landscape", margins: marginOptions });
                    y = drawHeaders(30);
                }

                let x = startX;
                rowData.forEach((cell, i) => {
                    doc.rect(x, y, colWidths[i], maxRowHeight).stroke();
                    drawCellContent(cell, x, y, colWidths[i], maxRowHeight, i === 11); // i === 11 is the Signature column
                    x += colWidths[i];
                });
                y += maxRowHeight;
            });
        }

        drawFooter();
        doc.end();
    } catch (err) {
        console.error("Error generating report:", err);
        res.status(500).json({ message: "Report failed" });
    }
});

module.exports = router;