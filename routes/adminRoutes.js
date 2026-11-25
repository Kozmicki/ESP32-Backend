// Express router sadrži administratorske API krajnje točke.
const express = require("express");
const router = express.Router();

// Provjera statusa dostupna je isključivo prijavljenom administratoru.
const getServerStatus = require("../controllers/statusController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

router.get("/status", requireAuth, requireAdmin, getServerStatus);

module.exports = router;
