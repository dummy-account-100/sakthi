const express = require("express");
const router = express.Router();
const componentController = require("../controllers/componentController");

router.get("/", componentController.getComponents);
router.post("/add", componentController.addComponent);
// Route to update everything
router.put("/:code", componentController.updateComponent);
// Quick toggle route
router.patch("/:code/status", componentController.toggleComponentStatus);
router.delete("/:code", componentController.deleteComponent);

module.exports = router;