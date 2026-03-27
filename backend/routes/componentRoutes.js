const express = require("express");
const router = express.Router();
const componentController = require("../controllers/componentController");

router.get("/", componentController.getComponents);
router.post("/add", componentController.addComponent);
// Notice we use encodeURIComponent on the frontend since 'code' has hyphens/special chars
router.put("/:code", componentController.updateComponent);
router.delete("/:code", componentController.deleteComponent);

module.exports = router;