// Express router organizira krajnje točke za prijavu i sesiju.
const express = require("express");
const router = express.Router();

// Učitava funkcije prijave i provjere trenutačnog korisnika.
const {
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

// POST /api/auth/login provjerava vjerodajnice i otvara sesiju.
router.post("/login", login);

// Ostatak auth API-ja dostupan je samo prijavljenom korisniku.
router.use(requireAuth);
router.get("/me", getCurrentUser);
router.post("/logout", logout);

module.exports = router;
