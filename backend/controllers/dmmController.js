const sql = require('../db');

// --- Operator Fetch (FIXED 500 ERROR) ---
exports.getDetails = async (req, res) => {
  try {
    const { date, disa } = req.query;

    // 1. Fetch Users for dropdowns
    const operatorsRes = await sql.query`SELECT username AS OperatorName FROM dbo.Users WHERE role = 'operator' ORDER BY username`;
    const supervisorsRes = await sql.query`SELECT username AS supervisorName FROM dbo.Users WHERE role = 'supervisor' ORDER BY username`;

    // 2. Fetch the Base Records
    const recordsRes = await sql.query`
      SELECT * FROM DmmSettingParameters 
      WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      ORDER BY Shift ASC, RowIndex ASC
    `;

    // 3. Fetch Custom Values linked to these records
    // We extract IDs safely to prevent "map of undefined" or empty string errors
    const records = recordsRes.recordset || [];
    const recordIds = records.map(r => r.id).filter(id => id != null);

    let customValuesMap = {};

    if (recordIds.length > 0) {
      // We use a join or a safe IN clause
      const idList = recordIds.join(',');
      const customRes = await sql.query(`
            SELECT rowId, columnId, value 
            FROM DmmCustomColumnValues 
            WHERE rowId IN (${idList})
        `);

      customRes.recordset.forEach(cv => {
        if (!customValuesMap[cv.rowId]) customValuesMap[cv.rowId] = {};
        customValuesMap[cv.rowId][cv.columnId] = cv.value;
      });
    }

    // 4. Initialize result structures
    const shiftsData = { 1: [], 2: [], 3: [] };
    const shiftsMeta = {
      1: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
      2: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
      3: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }
    };

    // 5. Populate Data
    records.forEach(row => {
      // Safely attach custom values if they exist for this row ID
      const rowId = row.id;
      const mappedRow = {
        ...row,
        customValues: customValuesMap[rowId] || {}
      };

      shiftsData[row.Shift].push(mappedRow);

      // Update Meta (Operator/Supervisor info is usually the same for all rows in a shift)
      shiftsMeta[row.Shift] = {
        operator: row.OperatorName || '',
        supervisor: row.SupervisorName || '',
        supervisorSignature: row.SupervisorSignature || '',
        isIdle: row.IsIdle === true || row.IsIdle === 1
      };
    });

    // 6. Send Response
    res.json({
      operators: operatorsRes.recordset,
      supervisors: supervisorsRes.recordset,
      shiftsData,
      shiftsMeta
    });
  } catch (err) {
    console.error('DMM Details Fetch Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// --- Operator Save ---
exports.saveDetails = async (req, res) => {
  try {
    const { date, disa, shiftsData, shiftsMeta } = req.body;
    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      // 1. Find existing IDs to delete their custom values first (Foreign Key cleanup)
      const existingReq = new sql.Request(transaction);
      const existingRes = await existingReq.query`SELECT id FROM DmmSettingParameters WHERE RecordDate = ${date} AND DisaMachine = ${disa}`;
      const existingIds = existingRes.recordset.map(r => r.id).join(',');

      if (existingIds) {
        await new sql.Request(transaction).query(`DELETE FROM DmmCustomColumnValues WHERE rowId IN (${existingIds})`);
      }

      // 2. Delete existing base records
      const deleteReq = new sql.Request(transaction);
      await deleteReq.query`DELETE FROM DmmSettingParameters WHERE RecordDate = ${date} AND DisaMachine = ${disa}`;

      // 3. Insert fresh data
      for (const shift of [1, 2, 3]) {
        const rows = shiftsData[shift] || [];
        const meta = shiftsMeta[shift] || { operator: '', supervisor: '', isIdle: false };
        const isIdleVal = meta.isIdle ? 1 : 0;
        const rowsToSave = rows.length > 0 ? rows : [{}];

        for (let i = 0; i < rowsToSave.length; i++) {
          const row = rowsToSave[i];
          const insertReq = new sql.Request(transaction);

          // Insert Base Row and get the new ID
          const insertRes = await insertReq.query`
                INSERT INTO DmmSettingParameters (
                    RecordDate, DisaMachine, Shift, OperatorName, SupervisorName, IsIdle, RowIndex,
                    Customer, ItemDescription, Time, PpThickness, PpHeight, SpThickness, SpHeight,
                    CoreMaskOut, CoreMaskIn, SandShotPressure, CorrectionShotTime, SqueezePressure,
                    PpStripAccel, PpStripDist, SpStripAccel, SpStripDist, MouldThickness, CloseUpForce, Remarks
                ) 
                OUTPUT INSERTED.id
                VALUES (
                    ${date}, ${disa}, ${shift}, ${meta.operator}, ${meta.supervisor}, ${isIdleVal}, ${i},
                    ${row.Customer || ''}, ${row.ItemDescription || ''}, ${row.Time || ''}, 
                    ${row.PpThickness || ''}, ${row.PpHeight || ''}, ${row.SpThickness || ''}, ${row.SpHeight || ''},
                    ${row.CoreMaskOut || ''}, ${row.CoreMaskIn || ''}, ${row.SandShotPressure || ''}, 
                    ${row.CorrectionShotTime || ''}, ${row.SqueezePressure || ''},
                    ${row.PpStripAccel || ''}, ${row.PpStripDist || ''}, ${row.SpStripAccel || ''}, 
                    ${row.SpStripDist || ''}, ${row.MouldThickness || ''}, ${row.CloseUpForce || ''}, ${row.Remarks || ''}
                )
              `;

          const newRowId = insertRes.recordset[0].id;

          // Insert Custom Column Values for this row
          if (row.customValues && Object.keys(row.customValues).length > 0) {
            for (const [colId, val] of Object.entries(row.customValues)) {
              if (val !== '' && val !== null && val !== undefined) {
                const cvReq = new sql.Request(transaction);
                await cvReq.query`
                              INSERT INTO DmmCustomColumnValues (rowId, columnId, value)
                              VALUES (${newRowId}, ${colId}, ${val.toString()})
                          `;
              }
            }
          }
        }
      }
      await transaction.commit();
      res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) { await transaction.rollback(); res.status(500).send('Database Transaction Error'); }
  } catch (err) { res.status(500).send('Server Error'); }
};

// --- Fetch Bulk Data for Admin PDF Export ---
// --- Fetch Bulk Data for Admin PDF Export ---
// --- Fetch Bulk Data for Admin PDF Export ---
// --- Fetch Bulk Data for Admin PDF Export ---
exports.getBulkData = async (req, res) => {
  try {
    // 🔥 DEBUG LOG 1: See exactly what the frontend is sending


    // Fallbacks just in case the frontend uses different variable names
    const fromDate = req.query.fromDate || req.query.startDate || req.query.from;
    const toDate = req.query.toDate || req.query.endDate || req.query.to;

    // 1. Fetch the Dynamic Master Columns
    const masterRes = await sql.query`
            SELECT * FROM DmmSetting_Master 
            WHERE IsDeleted = 0 OR IsDeleted IS NULL 
            ORDER BY SlNo ASC
        `;

    // 2. Fetch the Base Records
    let records = [];
    if (fromDate && toDate) {

      const recordsRes = await sql.query`
                SELECT * FROM DmmSettingParameters
                WHERE RecordDate >= ${fromDate} AND RecordDate <= ${toDate}
                ORDER BY RecordDate ASC, Shift ASC, RowIndex ASC
            `;
      records = recordsRes.recordset || [];
    } else {

      const recordsRes = await sql.query`
                SELECT * FROM DmmSettingParameters
                ORDER BY RecordDate ASC, Shift ASC, RowIndex ASC
            `;
      records = recordsRes.recordset || [];
    }

    // 🔥 DEBUG LOG 2: See how many base records were found


    let mergedRecords = [...records];

    // 3. Fetch Custom Column Values
    if (records.length > 0) {
      const recordIds = records.map(r => r.id).filter(id => id != null);

      if (recordIds.length > 0) {
        const idList = recordIds.join(',');
        const customRes = await sql.query(`
                    SELECT rowId, columnId, value 
                    FROM DmmCustomColumnValues 
                    WHERE rowId IN (${idList})
                `);

        const customData = customRes.recordset || [];

        mergedRecords = records.map(r => {
          const cVals = {};
          customData.filter(cv => cv.rowId === r.id).forEach(cv => { cVals[cv.columnId] = cv.value; });
          return { ...r, customValues: cVals };
        });
      }
    }

    // 🔥 DEBUG LOG 3: Verify the final payload structure


    res.json({
      master: masterRes.recordset || [],
      trans: mergedRecords
    });

  } catch (error) {
    console.error("❌ Failed to fetch bulk data:", error);
    res.status(500).json({ error: "Failed to fetch bulk data", details: error.message });
  }
};

// --- Supervisor Fetch ---
exports.getSupervisorReports = async (req, res) => {
  try {
    const { name } = req.params;
    const records = await sql.query`
      SELECT RecordDate as reportDate, DisaMachine as disa, Shift as shift, OperatorName, SupervisorSignature 
      FROM DmmSettingParameters
      WHERE SupervisorName = ${name}
      GROUP BY RecordDate, DisaMachine, Shift, OperatorName, SupervisorSignature
      ORDER BY RecordDate DESC, Shift ASC
    `;
    res.json(records.recordset);
  } catch (err) { res.status(500).send('Failed to fetch reports'); }
};

// --- Supervisor Sign ---
exports.signSupervisorReport = async (req, res) => {
  try {
    const { date, disaMachine, shift, signature } = req.body;
    await sql.query`
      UPDATE DmmSettingParameters 
      SET SupervisorSignature = ${signature} 
      WHERE RecordDate = ${date} AND DisaMachine = ${disaMachine} AND Shift = ${shift}
    `;
    res.json({ success: true, message: 'Signed successfully' });
  } catch (err) { res.status(500).send('Failed to sign report'); }
};