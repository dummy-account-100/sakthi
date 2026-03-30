const sql = require("../db");

// Helper: normalize any DB value of isActive → clean 'Active' or 'Inactive' string
const normalizeIsActive = (val) => {
  if (val === true || val === 1) return 'Active';
  if (val === false || val === 0) return 'Inactive';
  if (typeof val === 'string') {
    return val.trim().toLowerCase() === 'active' ? 'Active' : 'Inactive';
  }
  return 'Inactive'; // safe default
};

// 1. GET ALL COMPONENTS
exports.getComponents = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT code, description, pouredWeight, cavity, castedWeight, isActive 
      FROM Component 
      ORDER BY code ASC
    `;

    // SQL Server returns column names in the exact case from the schema definition.
    // Use a case-insensitive key lookup to find the actual isActive field
    // regardless of whether it comes back as 'isActive', 'IsActive', 'ISACTIVE', etc.
    const normalized = result.recordset.map(row => {
      const activeKey = Object.keys(row).find(k => k.toLowerCase() === 'isactive');
      const rawValue = activeKey ? row[activeKey] : undefined;
      console.log(`[DEBUG-SERVER] code=${row.code || row.Code}, activeKey=${activeKey}, rawValue=${rawValue}`);
      return {
        ...row,
        isActive: normalizeIsActive(rawValue)
      };
    });

    res.status(200).json(normalized);
  } catch (error) {
    console.error("Error fetching components:", error);
    res.status(500).json({ error: "Failed to fetch components." });
  }
};

// 2. ADD COMPONENT
exports.addComponent = async (req, res) => {
  const { code, description, pouredWeight, cavity, castedWeight, isActive } = req.body;

  if (!code || !description) {
    return res.status(400).json({ error: "Code and description are required." });
  }

  const activeValue = normalizeIsActive(isActive);

  try {
    await sql.query`
      INSERT INTO Component (code, description, pouredWeight, cavity, castedWeight, isActive)
      VALUES (${code}, ${description}, ${pouredWeight || null}, ${cavity || null}, ${castedWeight || null}, ${activeValue})
    `;
    res.status(201).json({ message: "Component added successfully!" });
  } catch (error) {
    if (error.number === 2627) return res.status(400).json({ error: "Component code already exists!" });
    res.status(500).json({ error: "Failed to add component." });
  }
};

// 3. UPDATE COMPONENT
exports.updateComponent = async (req, res) => {
  try {
    const { code } = req.params;
    const { description, pouredWeight, cavity, castedWeight, isActive } = req.body;

    if (!description) return res.status(400).json({ error: "Description is required." });

    const activeValue = normalizeIsActive(isActive);

    await sql.query`
      UPDATE Component 
      SET description = ${description}, 
          pouredWeight = ${pouredWeight || null}, 
          cavity = ${cavity || null}, 
          castedWeight = ${castedWeight || null},
          isActive = ${activeValue}
      WHERE code = ${code}
    `;

    res.status(200).json({ message: "Component updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update component." });
  }
};

// 4. TOGGLE COMPONENT STATUS
exports.toggleComponentStatus = async (req, res) => {
  try {
    const { code } = req.params;

    // Use LOWER() for case-insensitive string flip in the database
    await sql.query`
      UPDATE Component 
      SET isActive = CASE WHEN LOWER(LTRIM(RTRIM(CAST(isActive AS NVARCHAR(20))))) = 'active' THEN 'Inactive' ELSE 'Active' END
      WHERE code = ${code}
    `;

    res.status(200).json({ message: "Component status toggled successfully!" });
  } catch (error) {
    console.error("Error toggling status:", error);
    res.status(500).json({ error: "Failed to update status." });
  }
};

// 5. DELETE COMPONENT
exports.deleteComponent = async (req, res) => {
  try {
    const { code } = req.params;
    await sql.query`DELETE FROM Component WHERE code = ${code}`;
    res.status(200).json({ message: "Component deleted successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete component." });
  }
};