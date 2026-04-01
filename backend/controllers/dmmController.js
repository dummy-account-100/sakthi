const sql = require('../db');

exports.getDetails = async (req, res) => {
  try {
    const { date, disa } = req.query;

    const operatorsRes = await sql.query`SELECT username AS OperatorName FROM dbo.Users WHERE role IN ('operator', 'supervisor') ORDER BY username`;
    const supervisorsRes = await sql.query`SELECT username AS supervisorName FROM dbo.Users WHERE role = 'supervisor' ORDER BY username`;

    const recordsRes = await sql.query`
      SELECT * FROM DmmSettingParameters 
      WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      ORDER BY Shift ASC, RowIndex ASC
    `;

    const records = recordsRes.recordset || [];
    const recordIds = records.map(r => r.id).filter(id => id != null);

    let customValuesMap = {};
    if (recordIds.length > 0) {
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

    const shiftsData = { 1: [], 2: [], 3: [] };
    const shiftsMeta = {
      1: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
      2: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
      3: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }
    };

    records.forEach(row => {
      const rowId = row.id;
      const mappedRow = {
        ...row,
        customValues: customValuesMap[rowId] || {}
      };

      shiftsData[row.Shift].push(mappedRow);

      shiftsMeta[row.Shift] = {
        operator: row.OperatorName || '',
        supervisor: row.SupervisorName || '',
        supervisorSignature: row.SupervisorSignature || '',
        isIdle: row.IsIdle === true || row.IsIdle === 1
      };
    });

    // 🔥 FETCH QF HISTORY 
    let qfHistory = [];
    try {
      const qfRes = await sql.query`SELECT qfValue, date FROM DmmSettingQFvalues WHERE formName = 'dmm-setting-parameters' ORDER BY date DESC, id DESC`;
      qfHistory = qfRes.recordset;
    } catch (e) { console.error("DmmSettingQFvalues fetch error"); }

    res.json({
      operators: operatorsRes.recordset,
      supervisors: supervisorsRes.recordset,
      shiftsData,
      shiftsMeta,
      qfHistory // 🔥 Included in response
    });
  } catch (err) {
    console.error('DMM Details Fetch Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

// --- Operator Save (Per-Shift Upsert) ---
exports.saveDetails = async (req, res) => {
  try {
    const { date, disa, shiftsData, shiftsMeta, shiftsToSave } = req.body;
    // shiftsToSave is an array like [1, 3] telling backend which shifts to process.
    // If not provided, fall back to old behaviour (all shifts).
    const targetShifts = Array.isArray(shiftsToSave) ? shiftsToSave : [1, 2, 3];

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      for (const shift of targetShifts) {
        const meta = shiftsMeta[shift] || { operator: '', supervisor: '', isIdle: false };
        const rows = shiftsData[shift] || [];
        const isIdleVal = meta.isIdle ? 1 : 0;

        // 1. Fetch existing rows for this specific shift
        const existingReq = new sql.Request(transaction);
        const existingRes = await existingReq.query`
          SELECT id, SupervisorSignature FROM DmmSettingParameters 
          WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift}
        `;
        const existingRows = existingRes.recordset;

        // Preserve the existing supervisor signature if already signed
        const existingSignature = existingRows.length > 0
          ? (existingRows[0].SupervisorSignature || '')
          : '';

        // 2. Delete old custom values for this shift's rows
        if (existingRows.length > 0) {
          const idList = existingRows.map(r => r.id).join(',');
          await new sql.Request(transaction).query(
            `DELETE FROM DmmCustomColumnValues WHERE rowId IN (${idList})`
          );
        }

        // 3. Delete old base rows for this shift only
        await new sql.Request(transaction).query`
          DELETE FROM DmmSettingParameters 
          WHERE RecordDate = ${date} AND DisaMachine = ${disa} AND Shift = ${shift}
        `;

        // 4. Insert fresh rows for this shift
        const rowsToSave = rows.length > 0 ? rows : [{}];
        for (let i = 0; i < rowsToSave.length; i++) {
          const row = rowsToSave[i];
          const insertReq = new sql.Request(transaction);

          const insertRes = await insertReq.query`
            INSERT INTO DmmSettingParameters (
              RecordDate, DisaMachine, Shift, OperatorName, SupervisorName,
              IsIdle, RowIndex, SupervisorSignature,
              Customer, ItemDescription, Time, PpThickness, PpHeight,
              SpThickness, SpHeight, CoreMaskOut, CoreMaskIn,
              SandShotPressure, CorrectionShotTime, SqueezePressure,
              PpStripAccel, PpStripDist, SpStripAccel, SpStripDist,
              MouldThickness, CloseUpForce, Remarks
            )
            OUTPUT INSERTED.id
            VALUES (
              ${date}, ${disa}, ${shift}, ${meta.operator || ''},
              ${meta.supervisor || ''}, ${isIdleVal}, ${i},
              ${existingSignature},
              ${row.Customer || ''}, ${row.ItemDescription || ''},
              ${row.Time || ''}, ${row.PpThickness || ''}, ${row.PpHeight || ''},
              ${row.SpThickness || ''}, ${row.SpHeight || ''},
              ${row.CoreMaskOut || ''}, ${row.CoreMaskIn || ''},
              ${row.SandShotPressure || ''}, ${row.CorrectionShotTime || ''},
              ${row.SqueezePressure || ''}, ${row.PpStripAccel || ''},
              ${row.PpStripDist || ''}, ${row.SpStripAccel || ''},
              ${row.SpStripDist || ''}, ${row.MouldThickness || ''},
              ${row.CloseUpForce || ''}, ${row.Remarks || ''}
            )
          `;

          const newRowId = insertRes.recordset[0].id;

          // 5. Insert custom column values
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
    } catch (err) {
      await transaction.rollback();
      console.error('DMM Save Transaction Error:', err);
      res.status(500).json({ error: 'Database Transaction Error', details: err.message });
    }
  } catch (err) {
    console.error('DMM Save Server Error:', err);
    res.status(500).json({ error: 'Server Error', details: err.message });
  }
};

exports.getBulkData = async (req, res) => {
  try {
    const fromDate = req.query.fromDate || req.query.startDate || req.query.from;
    const toDate = req.query.toDate || req.query.endDate || req.query.to;

    const masterRes = await sql.query`
            SELECT * FROM DmmSetting_Master 
            WHERE IsDeleted = 0 OR IsDeleted IS NULL 
            ORDER BY SlNo ASC
        `;

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

    let mergedRecords = [...records];

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

    // 🔥 FETCH QF HISTORY FOR BULK EXPORT 
    let qfHistory = [];
    try {
      const qfRes = await sql.query`SELECT qfValue, date FROM DmmSettingQFvalues WHERE formName = 'dmm-setting-parameters' ORDER BY date DESC, id DESC`;
      qfHistory = qfRes.recordset;
    } catch (e) { console.error("DmmSettingQFvalues fetch error"); }

    res.json({
      master: masterRes.recordset || [],
      trans: mergedRecords,
      qfHistory // 🔥 Included in response
    });

  } catch (error) {
    console.error("❌ Failed to fetch bulk data:", error);
    res.status(500).json({ error: "Failed to fetch bulk data", details: error.message });
  }
};

// --- Supervisor Fetch (one entry per shift, no duplicates) ---
exports.getSupervisorReports = async (req, res) => {
  try {
    const { name } = req.params;
    // Use MIN(id) to pick the first-ever submission per shift so the supervisor
    // only sees one sign-off request per (date, DISA, shift).
    const records = await sql.query`
      SELECT 
        RecordDate as reportDate, 
        DisaMachine as disa, 
        Shift as shift, 
        MAX(OperatorName) as OperatorName,
        MAX(SupervisorSignature) as SupervisorSignature
      FROM DmmSettingParameters
      WHERE SupervisorName = ${name}
      GROUP BY RecordDate, DisaMachine, Shift
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