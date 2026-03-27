const sql = require("../db");

// 1. GET ALL COMPONENTS
exports.getComponents = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT code, description, pouredWeight, cavity, castedWeight 
      FROM Component 
      ORDER BY code ASC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching components:", error);
    res.status(500).json({ error: "Failed to fetch components." });
  }
};

// 2. ADD COMPONENT
exports.addComponent = async (req, res) => {
  const { code, description, pouredWeight, cavity, castedWeight } = req.body;

  if (!code || !description) {
    return res.status(400).json({ error: "Code and description are required." });
  }

  try {
    await sql.query`
      INSERT INTO Component (code, description, pouredWeight, cavity, castedWeight)
      VALUES (${code}, ${description}, ${pouredWeight || null}, ${cavity || null}, ${castedWeight || null})
    `;
    res.status(201).json({ message: "Component added successfully!" });
  } catch (error) {
    console.error("Error adding component:", error);
    // 2627 is Unique Constraint Violation (Primary Key exists)
    if (error.number === 2627) {
      return res.status(400).json({ error: "Component code already exists!" });
    }
    res.status(500).json({ error: "Failed to add component." });
  }
};

// 3. UPDATE COMPONENT
exports.updateComponent = async (req, res) => {
  try {
    const { code } = req.params;
    const { description, pouredWeight, cavity, castedWeight } = req.body;

    if (!description) {
      return res.status(400).json({ error: "Description is required." });
    }

    await sql.query`
      UPDATE Component 
      SET description = ${description}, 
          pouredWeight = ${pouredWeight || null}, 
          cavity = ${cavity || null}, 
          castedWeight = ${castedWeight || null}
      WHERE code = ${code}
    `;

    res.status(200).json({ message: "Component updated successfully!" });
  } catch (error) {
    console.error("Error updating component:", error);
    res.status(500).json({ error: "Failed to update component." });
  }
};

// 4. DELETE COMPONENT
exports.deleteComponent = async (req, res) => {
  try {
    const { code } = req.params;

    await sql.query`
      DELETE FROM Component 
      WHERE code = ${code}
    `;

    res.status(200).json({ message: "Component deleted successfully!" });
  } catch (error) {
    console.error("Error deleting component:", error);
    res.status(500).json({ error: "Failed to delete component." });
  }
};