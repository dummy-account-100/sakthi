import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB');
};

const getReportMonthYear = (fromDate) => {
    const d = new Date(fromDate);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// ============================================================================
// 1. UNPOURED MOULD DETAILS
// ============================================================================
export const generateUnPouredMouldPDF = async (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const records = data.records || [];

    if (records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`UnPouredMouldDetails_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let customCols = [];
    try {
        const configRes = await fetch('http://localhost:5000/api/config/unpoured-mould-details/master');
        const configData = await configRes.json();
        customCols = (configData.config || []).map(c => ({
            key: `custom_${c.id}`, id: c.id, label: c.reasonName.toUpperCase().replace(' ', '\n'), group: c.department.toUpperCase(), isCustom: true
        }));
    } catch(e) { console.error("Could not fetch Unpoured custom schema for PDF"); }

    const baseColumns = [
      { key: 'PatternChange', label: 'PATTERN\nCHANGE', group: 'MOULDING' }, { key: 'HeatCodeChange', label: 'HEAT CODE\nCHANGE', group: 'MOULDING' },
      { key: 'MouldBroken', label: 'MOULD\nBROKEN', group: 'MOULDING' }, { key: 'AmcCleaning', label: 'AMC\nCLEANING', group: 'MOULDING' },
      { key: 'MouldCrush', label: 'MOULD\nCRUSH', group: 'MOULDING' }, { key: 'CoreFalling', label: 'CORE\nFALLING', group: 'MOULDING' },
      { key: 'SandDelay', label: 'SAND\nDELAY', group: 'SAND PLANT' }, { key: 'DrySand', label: 'DRY\nSAND', group: 'SAND PLANT' },
      { key: 'NozzleChange', label: 'NOZZLE\nCHANGE', group: 'PREESPOUR' }, { key: 'NozzleLeakage', label: 'NOZZLE\nLEAKAGE', group: 'PREESPOUR' },
      { key: 'SpoutPocking', label: 'SPOUT \nPOCKING', group: 'PREESPOUR' }, { key: 'StRod', label: 'S/T ROD\nCHANGE', group: 'PREESPOUR' },
      { key: 'QcVent', label: 'QC VENT/\nSLAG', group: 'QUALITY CONTROL' }, { key: 'OutMould', label: 'OUT\nMOULD', group: 'QUALITY CONTROL' },
      { key: 'LowMg', label: 'LOW\nMg', group: 'QUALITY CONTROL' }, { key: 'GradeChange', label: 'GRADE\nCHANGE', group: 'QUALITY CONTROL' },
      { key: 'MsiProblem', label: 'MSI\nPROBLEM', group: 'QUALITY CONTROL' }, { key: 'BrakeDown', label: 'BRAKE\nDOWN', group: 'MAINTENANCE' },
      { key: 'Wom', label: 'W/O M', group: 'FURNACE' }, { key: 'DevTrail', label: 'DEV/\nTRAIL', group: 'TOOLING' },
      { key: 'PowerCut', label: 'POWER\nCUT', group: 'OTHERS' }, { key: 'PlannedOff', label: 'PLANNED\nOFF', group: 'OTHERS' },
      { key: 'VatCleaning', label: 'VAT\nCLEANING', group: 'OTHERS' }, { key: 'Others', label: 'OTHERS', group: 'OTHERS' }
    ];

    const allColumns = [...baseColumns, ...customCols];

    const groupedByDate = {};
    records.forEach(row => {
        const dateKey = String(row.RecordDate).split('T')[0];
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = { 1: {}, 2: {}, 3: {} };
        groupedByDate[dateKey][row.Shift] = row;
    });

    const dates = Object.keys(groupedByDate).sort();

    dates.forEach((dateKey, pageIndex) => {
        if (pageIndex > 0) doc.addPage();

        const shiftsData = groupedByDate[dateKey];
        const disa = shiftsData[1]?.DisaMachine || shiftsData[2]?.DisaMachine || shiftsData[3]?.DisaMachine || 'DISA - I';

        doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text("UN POURED MOULD DETAILS", 148.5, 15, { align: 'center' });
        doc.setFontSize(11); doc.text(` ${disa}`, 8, 25);
        doc.text(`DATE: ${formatDate(dateKey)}`, 289 - doc.getTextWidth(`DATE: ${formatDate(dateKey)}`) - 8, 25);

        const headRow1 = [{ content: 'SHIFT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }];
        let currentGroup = null; let groupSpan = 0;
        allColumns.forEach((col) => {
            if (!currentGroup) { currentGroup = col.group; groupSpan = 1; }
            else if (currentGroup === col.group) { groupSpan++; }
            else {
                headRow1.push({ content: currentGroup, colSpan: groupSpan, styles: { halign: 'center' } });
                currentGroup = col.group; groupSpan = 1;
            }
        });
        if (currentGroup) headRow1.push({ content: currentGroup, colSpan: groupSpan, styles: { halign: 'center' } });
        headRow1.push({ content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [220, 220, 220] } });
        
        // 🔥 Add signature column header to PDF
        headRow1.push({ content: 'SIGNATURE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } });

        const headRow2 = allColumns.map(col => ({ content: col.label, styles: { halign: 'center', valign: 'middle', fontSize: 5.5 } }));

        const bodyRows = [1, 2, 3].map(shift => {
            const row = [shift.toString()];
            let rowTotal = 0;
            allColumns.forEach(col => {
                const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
                row.push(val === '' || val === null || val === undefined ? '-' : val.toString());
                rowTotal += parseInt(val) || 0;
            });
            row.push(rowTotal === 0 ? '-' : rowTotal.toString());
            row.push(''); // Empty cell for image
            return row;
        });

        const totalRow = ['TOTAL'];
        let grandTotal = 0;
        allColumns.forEach(col => {
            const colTotal = [1, 2, 3].reduce((sum, shift) => {
                const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
                return sum + (parseInt(val) || 0);
            }, 0);
            totalRow.push(colTotal === 0 ? '-' : colTotal.toString());
            grandTotal += colTotal;
        });
        totalRow.push(grandTotal === 0 ? '-' : grandTotal.toString());
        totalRow.push('-');
        bodyRows.push(totalRow);

        autoTable(doc, {
            startY: 32, margin: { left: 5, right: 5 }, head: [headRow1, headRow2], body: bodyRows, theme: 'grid',
            styles: { fontSize: 8, cellPadding: { top: 3.5, right: 1, bottom: 3.5, left: 1 }, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', minCellHeight: 12 }, bodyStyles: { minCellHeight: 10 },
            columnStyles: { [allColumns.length + 2]: { cellWidth: 25 } },
            didDrawCell: function(data) {
                // 🔥 Draw the signature image in the last column
                if (data.section === 'body' && data.column.index === allColumns.length + 2 && data.row.index < 3) {
                    const shift = data.row.index + 1;
                    const sigData = shiftsData[shift]?.OperatorSignature;
                    if (sigData && sigData.startsWith('data:image')) {
                        try { doc.addImage(sigData, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) {}
                    }
                }
            },
            didParseCell: function (data) { 
                if (data.section === 'body' && data.row.index === bodyRows.length - 1) { 
                    data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; 
                } 
            }
        });
    });

    doc.save(`UnPoured_Mould_Details_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 2. DMM SETTING PARAMETERS
// ============================================================================
export const generateDmmSettingPDF = async (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    const metaRecords = data.meta || [];
    const transRecords = data.trans || [];
    
    if (metaRecords.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`DMM_Setting_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let customCols = [];
    try {
        const configRes = await fetch('http://localhost:5000/api/config/dmm-setting-parameters/master');
        const configData = await configRes.json();
        customCols = (configData.config || []).map(c => ({
            key: `custom_${c.id}`, id: c.id, label: c.columnLabel.replace('\\n', '\n'), isCustom: true
        }));
    } catch(e) { console.error("Could not fetch DMM Custom Schema for PDF"); }

    const baseColumns = [
        { key: 'Customer', label: 'CUSTOMER' }, { key: 'ItemDescription', label: 'ITEM DESCRIPTION' }, { key: 'Time', label: 'TIME' },
        { key: 'PpThickness', label: 'PP\nTHICKNESS' }, { key: 'PpHeight', label: 'PP\nHEIGHT' },
        { key: 'SpThickness', label: 'SP\nTHICKNESS' }, { key: 'SpHeight', label: 'SP\nHEIGHT' },
        { key: 'CoreMaskOut', label: 'CORE MASK\n(OUT)' }, { key: 'CoreMaskIn', label: 'CORE MASK\n(IN)' },
        { key: 'SandShotPressure', label: 'SAND SHOT\nPRESSURE' }, { key: 'CorrectionShotTime', label: 'CORRECTION\nSHOT TIME' },
        { key: 'SqueezePressure', label: 'SQUEEZE\nPRESSURE' }, { key: 'PpStripAccel', label: 'PP STRIP\nACCEL' },
        { key: 'PpStripDist', label: 'PP STRIP\nDIST' }, { key: 'SpStripAccel', label: 'SP STRIP\nACCEL' },
        { key: 'SpStripDist', label: 'SP STRIP\nDIST' }, { key: 'MouldThickness', label: 'MOULD\nTHICKNESS' },
        { key: 'CloseUpForce', label: 'CLOSE UP\nFORCE' }, { key: 'Remarks', label: 'REMARKS' }
    ];

    const allColumns = [...baseColumns, ...customCols];

    const groupedData = {};
    metaRecords.forEach(m => {
        const d = String(m.RecordDate).split('T')[0];
        const machine = m.DisaMachine;
        const shift = m.Shift;

        if (!groupedData[d]) groupedData[d] = {};
        if (!groupedData[d][machine]) groupedData[d][machine] = { shiftsMeta: {}, shiftsData: {} };
        
        if (!groupedData[d][machine].shiftsMeta[shift]) {
            groupedData[d][machine].shiftsMeta[shift] = {
                operator: m.OperatorName || '',
                supervisor: m.SupervisorName || '',
                supervisorSignature: m.SupervisorSignature || '',
                isIdle: m.IsIdle === true || m.IsIdle === 1
            };
            groupedData[d][machine].shiftsData[shift] = [];
        }
    });

    transRecords.forEach(t => {
        const d = String(t.RecordDate).split('T')[0];
        if (groupedData[d] && groupedData[d][t.DisaMachine]) {
            groupedData[d][t.DisaMachine].shiftsData[t.Shift].push(t);
        }
    });

    let isFirstPage = true;

    Object.keys(groupedData).sort().forEach(dateKey => {
        Object.keys(groupedData[dateKey]).sort().forEach(machine => {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            const machineData = groupedData[dateKey][machine];
            
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI AUTO COMPONENT LIMITED", 148.5, 10, { align: 'center' });
            doc.setFontSize(16); doc.text("DMM SETTING PARAMETERS CHECK SHEET", 148.5, 18, { align: 'center' });

            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text(` ${machine}`, 10, 28);
            doc.text(`DATE: ${formatDate(dateKey)}`, 280, 28, { align: 'right' });

            autoTable(doc, {
                startY: 32, margin: { left: 10, right: 10 },
                head: [['SHIFT', 'OPERATOR NAME', 'VERIFIED BY', 'SIGNATURE']],
                body: [1, 2, 3].map(s => {
                    const m = machineData.shiftsMeta[s] || {};
                    return [`SHIFT ${s === 1 ? 'I' : s === 2 ? 'II' : 'III'}`, m.operator || '-', m.supervisor || '-', ''];
                }),
                theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                didDrawCell: function (data) {
                    if (data.section === 'body' && data.column.index === 3) {
                        const m = machineData.shiftsMeta[data.row.index + 1] || {};
                        if (m.supervisorSignature && m.supervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(m.supervisorSignature, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) {}
                        }
                    }
                }
            });

            let currentY = doc.lastAutoTable.finalY + 8;

            [1, 2, 3].forEach((shift, index) => {
                const m = machineData.shiftsMeta[shift] || {};
                const t = machineData.shiftsData[shift] || [];
                const isIdle = m.isIdle === true || Number(m.isIdle) === 1;
                const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';

                const tableHeader = [
                    [{ content: `SHIFT ${shiftLabel}`, colSpan: allColumns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0, 0, 0] } }],
                    [{ content: 'S.No', styles: { cellWidth: 8 } }, ...allColumns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))]
                ];

                let tableBody = [];
                if (isIdle) {
                    tableBody.push([{ content: 'L I N E   I D L E', colSpan: allColumns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]);
                } else {
                    const rowsObj = {};
                    t.forEach(record => {
                        if (!rowsObj[record.RowUUID]) rowsObj[record.RowUUID] = {};
                        rowsObj[record.RowUUID][record.MasterId] = record.Value;
                    });
                    
                    const rowsArr = Object.values(rowsObj);
                    if(rowsArr.length === 0) rowsArr.push({});

                    tableBody = rowsArr.map((row, idx) => {
                        const pdfRow = [(idx + 1).toString()];
                        allColumns.forEach(col => {
                            const val = row[col.MasterId || col.id];
                            pdfRow.push(val === '' || val === null || val === undefined ? '-' : val.toString());
                        });
                        return pdfRow;
                    });
                }

                autoTable(doc, {
                    startY: currentY, margin: { left: 5, right: 5 }, head: tableHeader, body: tableBody, theme: 'grid',
                    styles: { fontSize: 5.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
                    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
                    columnStyles: { 0: { cellWidth: 8 } }
                });

                currentY = doc.lastAutoTable.finalY + 5;
                if (currentY > 175 && index < 2) { doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200); doc.addPage(); currentY = 15; }
            });

            doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
        });
    });

    doc.save(`DMM_Setting_Parameters_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 3 & 4. DISA OPERATOR & LPA CHECKLIST (FIXED "SIG 1" BUG)
// ============================================================================
export const generateChecklistPDF = (data, dateRange, title1, title2) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const { master, trans, ncr } = data;

    if (!trans || trans.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`${title1.replace(/\s+/g, '_')}_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const machines = [...new Set(trans.map(t => t.DisaMachine))].sort();
    let isFirstPage = true;

    const isLPA = title1.includes('AUDIT');

    machines.forEach(machine => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const machineTrans = trans.filter(t => t.DisaMachine === machine);
        const machineNc = ncr ? ncr.filter(n => n.DisaMachine === machine) : [];

        const historyMap = {};
        const holidayDays = new Set();
        const vatDays = new Set();
        const sig1Map = {}; 
        const sig2Map = {};

        machineTrans.forEach(log => {
            const dateObj = new Date(log.LogDate);
            const logDay = dateObj.getDate();
            const key = String(log.MasterId);

            if (Number(log.IsHoliday) === 1 || log.IsHoliday === true) holidayDays.add(logDay);
            if (Number(log.IsVatCleaning) === 1 || log.IsVatCleaning === true) vatDays.add(logDay);

            if (log.OperatorSignature) sig1Map[logDay] = log.OperatorSignature;
            if (log.SupervisorSignature) sig1Map[logDay] = log.SupervisorSignature;
            
            if (log.HODSignature) sig2Map[logDay] = log.HODSignature;
            if (log.HOFSignature) sig2Map[logDay] = log.HOFSignature;

            if (!historyMap[key]) historyMap[key] = {};
            
            if (Number(log.IsNa) === 1 || log.IsNa === true || Number(log.IsNA) === 1 || log.IsNA === true) {
                historyMap[key][logDay] = 'NA';
            } else if (log.ReadingValue) {
                historyMap[key][logDay] = log.ReadingValue;
            } else {
                historyMap[key][logDay] = (Number(log.IsDone) === 1 || log.IsDone === true) ? 'Y' : 'N';
            }
        });

        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
        doc.rect(50, 10, 180, 20); doc.setFontSize(16);
        doc.text(title1, 140, 22, { align: 'center' });
        doc.rect(230, 10, 57, 20); doc.setFontSize(11);
        doc.text(`${machine}`, 258, 18, { align: 'center' });
        doc.line(230, 22, 287, 22);
        doc.setFontSize(10); doc.text(`Month: ${getReportMonthYear(dateRange.from)}`, 235, 27);

        const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

        const tableBody = master.map((item, rowIndex) => {
            const row = [String(item.SlNo), item.CheckPointDesc, item.CheckMethod || 'VISUAL'];
            for (let i = 1; i <= 31; i++) {
                if (holidayDays.has(i)) {
                    if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: master.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } });
                } else if (vatDays.has(i)) {
                    if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: master.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } });
                } else {
                    row.push(historyMap[item.MasterId]?.[i] || '');
                }
            }
            return row;
        });

        const sig1Label = isLPA ? "SUPERVISOR SIGN" : "OPERATOR SIGN";
        const sig2Label = isLPA ? "HOF SIGN" : "HOD - MOU SIGN";

        const sig1Row = ["", sig1Label, ""];
        const sig2Row = ["", sig2Label, ""];
        
        for (let i = 1; i <= 31; i++) {
           // We push empty strings because we will draw the image based on the maps in didDrawCell
           sig1Row.push("");
           sig2Row.push("");
        }

        const footerRows = [sig1Row, sig2Row];
        const dynamicColumnStyles = {};
        for (let i = 3; i < 34; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

        autoTable(doc, {
            startY: 35,
            head: [['Sl.No', 'CHECK POINTS', 'CHECK METHOD', ...days]],
            body: [...tableBody, ...footerRows],
            theme: 'grid', styles: { fontSize: 6, cellPadding: 0.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, ...dynamicColumnStyles },
            didDrawCell: function(data) {
                // Draw Signature Images if they exist
                if (data.row.index >= tableBody.length && data.column.index > 2) {
                    const dayIndex = data.column.index - 2; 
                    const isSig1Row = data.row.index === tableBody.length;
                    
                    const sigData = isSig1Row ? sig1Map[dayIndex] : sig2Map[dayIndex];
                    if (sigData && sigData.startsWith('data:image')) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                        try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch(e){}
                    }
                }
            },
            didParseCell: function (data) {
                if (data.row.index >= tableBody.length && data.column.index === 1) data.cell.styles.fontStyle = 'bold';
                
                // 🔥 CRITICAL FIX: Erase EVERYTHING inside the signature cells so "SIG 1" never prints
                if (data.row.index >= tableBody.length && data.column.index > 2) {
                    data.cell.text = [];
                }

                if (data.column.index > 2 && data.row.index < tableBody.length) {
                    const text = data.cell.text?.[0] || '';
                    if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = ['3']; data.cell.styles.textColor = [0, 100, 0]; }
                    else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = ['X']; data.cell.styles.fontStyle = 'bold'; }
                    else if (text === 'NA') { data.cell.styles.fontSize = 5; data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fontStyle = 'bold'; }
                }
            }
        });

        doc.setFontSize(8); 
        if(isLPA) {
            doc.setFont('helvetica', 'bold');
            doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, doc.lastAutoTable.finalY + 5);
            doc.setFont('helvetica', 'normal');
        }
        doc.text(isLPA ? "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022" : "QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);

        if (machineNc.length > 0) {
            doc.addPage();
            doc.setLineWidth(0.3);
            doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
            doc.rect(50, 10, 237, 20); doc.setFontSize(16);
            doc.text(title2, 168, 18, { align: 'center' }); doc.setFontSize(14);
            doc.text("Non-Conformance Report", 168, 26, { align: 'center' });

            const ncRows = machineNc.map((report, index) => [
                index + 1, formatDate(report.ReportDate), report.NonConformityDetails || '', report.Correction || '',
                report.RootCause || '', report.CorrectiveAction || '', report.TargetDate ? formatDate(report.TargetDate) : '',
                report.Responsibility || '', '', report.Status || '' // Leave 8 empty for image
            ]);

            autoTable(doc, {
                startY: 35, head: [['S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', isLPA ? 'Signature' : 'Name', 'Status']],
                body: ncRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
                headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
                columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20, halign: 'center' }, 9: { cellWidth: 20, halign: 'center' } },
                didDrawCell: function(data) {
                    if (isLPA && data.section === 'body' && data.column.index === 8) {
                        const rowData = machineNc[data.row.index];
                        if (rowData && rowData.SupervisorSignature && rowData.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(rowData.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){}
                        }
                    }
                },
                didParseCell: function(data) {
                    if (isLPA && data.section === 'body' && data.column.index === 8) {
                        data.cell.text = []; // Force empty string
                    }
                    if (data.section === 'body' && data.column.index === 9) {
                        const statusText = (data.cell.text || [])[0] || '';
                        if (statusText === 'Completed') { data.cell.styles.textColor = [0, 150, 0]; data.cell.styles.fontStyle = 'bold'; }
                        else if (statusText === 'Pending') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
                    }
                }
            });
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(isLPA ? "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022" : "QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
        }
    });

    const safeTitle = title1.replace(/\s+/g, '_');
    doc.save(`${safeTitle}_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 5. ERROR PROOF VERIFICATION
// ============================================================================
export const generateErrorProofPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const { verifications, plans } = data;

    if (!verifications || verifications.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`ErrorProof_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const groupedByDateAndMachine = {};
    verifications.forEach(row => {
        const dateKey = String(row.recordDate).split('T')[0];
        const machine = row.line;
        if (!groupedByDateAndMachine[dateKey]) groupedByDateAndMachine[dateKey] = {};
        if (!groupedByDateAndMachine[dateKey][machine]) groupedByDateAndMachine[dateKey][machine] = { v: [], r: [] };
        groupedByDateAndMachine[dateKey][machine].v.push(row);
    });

    plans.forEach(plan => {
        const dateKey = String(plan.recordDate).split('T')[0];
        const machine = verifications.find(v => v.errorProofName === plan.errorProofName)?.line;
        if (machine && groupedByDateAndMachine[dateKey] && groupedByDateAndMachine[dateKey][machine]) {
            groupedByDateAndMachine[dateKey][machine].r.push(plan);
        }
    });

    let isFirstPage = true;
    Object.keys(groupedByDateAndMachine).sort().forEach(dateKey => {
        Object.keys(groupedByDateAndMachine[dateKey]).sort().forEach(machine => {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            const records = groupedByDateAndMachine[dateKey][machine];
            const headerData = { date: dateKey, disaMachine: machine, reviewedBy: records.v[0]?.ReviewedByHOF || '', approvedBy: records.v[0]?.ApprovedBy || '' };

            doc.setLineWidth(0.3);
            doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
            doc.rect(50, 10, 180, 20); doc.setFontSize(16);
            doc.text("ERROR PROOF VERIFICATION REPORT", 140, 22, { align: 'center' });
            doc.rect(230, 10, 57, 20); doc.setFontSize(11);
            doc.text(`${machine}`, 258, 18, { align: 'center' });
            doc.line(230, 22, 287, 22);
            doc.setFontSize(10); doc.text(`DATE: ${formatDate(dateKey)}`, 235, 27);

            const vRows = records.v.map((item, index) => [
                index + 1, item.line, item.errorProofName, item.natureOfErrorProof, item.frequency,
                item.Date1_Shift1_Res === 'OK' ? 'OK' : item.Date1_Shift1_Res === 'NOT OK' ? 'NOT OK' : '-',
                item.Date1_Shift2_Res === 'OK' ? 'OK' : item.Date1_Shift2_Res === 'NOT OK' ? 'NOT OK' : '-',
                item.Date1_Shift3_Res === 'OK' ? 'OK' : item.Date1_Shift3_Res === 'NOT OK' ? 'NOT OK' : '-'
            ]);

            autoTable(doc, {
                startY: 35,
                head: [[{ content: 'S.No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, { content: 'Line', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, { content: 'Error Proof Name', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, { content: 'Nature of Error Proof', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, { content: 'Frequency', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, { content: 'Verification Result', colSpan: 3, styles: { halign: 'center' } }], ['I - Shift', 'II - Shift', 'III - Shift']],
                body: vRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold' }
            });

            let currentY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("Reaction Plan", 148.5, currentY, { align: 'center' });
            currentY += 5;

            const rRows = records.r.map((item, index) => [index + 1, item.errorProofNo || '-', item.errorProofName, item.shift, item.problem, item.rootCause, item.correctiveAction, item.status, item.remarks]);
            autoTable(doc, {
                startY: currentY,
                head: [['S.No', 'Ep.No', 'Error Proof Name', 'Verification \n Date & Shift', 'Problem', 'Root Cause', 'Corrective action taken \n (Temporary)', 'Status', 'Remarks']],
                body: rRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 15 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 40 }, 7: { cellWidth: 20 }, 8: { cellWidth: 20 } }
            });

            currentY = doc.lastAutoTable.finalY + 15;
            autoTable(doc, {
                startY: currentY, margin: { left: 10, right: 10 }, head: [['REVIEWED BY HOF', 'APPROVED BY']], body: [[headerData.reviewedBy || '', headerData.approvedBy || '']], theme: 'grid',
                styles: { fontSize: 10, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', minCellHeight: 15 }, headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
            });

            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
        });
    });

    doc.save(`ErrorProof_Verification_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 6. DISA SETTING ADJUSTMENT RECORD
// ============================================================================
export const generateDisaSettingAdjustmentPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    if (!data || data.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`DISA_SettingAdjustment_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const processText = (text) => {
        if (!text) return '';
        if (text.includes(',') && !text.includes('•')) {
            return text.split(',').map(item => `• ${item.trim()}`).join('\n');
        }
        return text;
    };

    doc.setLineWidth(0.3);
    doc.rect(10, 10, 50, 20);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text("SAKTHI", 35, 18, { align: 'center' });
    doc.text("AUTO", 35, 26, { align: 'center' });

    doc.rect(60, 10, 167, 20);
    doc.setFontSize(15);
    doc.text("DISA SETTING ADJUSTMENT RECORD", 143, 22, { align: 'center' });

    doc.rect(227, 10, 60, 20);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`From: ${formatDate(dateRange.from)}`, 232, 18);
    doc.text(`To:   ${formatDate(dateRange.to)}`, 232, 26);

    const tableRows = data.map((row, index) => {
        const customValues = Object.values(row.customValues || {});
        
        return [
            index + 1,
            formatDate(row.recordDate),
            row.mouldCountNo || '-',
            row.noOfMoulds != null ? row.noOfMoulds.toString() : '-',
            processText(row.workCarriedOut) || '-',
            processText(row.preventiveWorkCarried) || '-',
            row.operatorSignature || '', 
            row.remarks || '-',
            ...customValues
        ];
    });

    const hasCustomCols = data[0] && data[0].customValues && Object.keys(data[0].customValues).length > 0;
    const baseHeaders = ['S.No', 'Date', 'Mould Count No.', 'No. of\nMoulds', 'Work Carried Out', 'Preventive Work\nCarried', 'Operator\nSignature', 'Remarks'];
    const customHeaders = hasCustomCols ? Object.keys(data[0].customValues).map((_, i) => `Custom ${i+1}`) : [];
    const allHeaders = [...baseHeaders, ...customHeaders];

    autoTable(doc, {
        startY: 35,
        margin: { left: 10, right: 10 },
        head: [allHeaders],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 25, halign: 'center' }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 'auto' }, 5: { cellWidth: 'auto' }, 6: { cellWidth: 25, halign: 'center', valign: 'middle' }, 7: { cellWidth: 30 } },
        didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) {
                const sigData = data.row.raw[6];
                if (sigData && sigData.startsWith('data:image')) {
                    try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4); } catch(e) {}
                }
            }
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) { data.cell.text = ''; }
        }
    });

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text("QF/07/FBP-02, Rev. No.01 Dt 14.05.2025", 10, 200);

    doc.save(`DISA_SettingAdjustment_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};