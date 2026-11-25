
// Express se koristi za kreiranje ruter-a i definiranje HTTP ruta.
const express = require("express");

// Router grupira endpoint-e pod jednu zajedničku putanju.
const router = express.Router();

// Preuzima funkcije koje implementiraju stvarne operacije nad korisnicima.
const {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
} = require("../controllers/userController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Sve operacije nad korisničkim računima dostupne su samo administratoru.
router.use(requireAuth, requireAdmin);

// Administrator može kreirati obične korisničke račune.
router.post("/", createUser);

// GET /api/users vraća sve korisnike.
router.get("/", getAllUsers);

// READ ONE
// GET /api/users/:id vraća korisnika s određenim ID-em.
router.get("/:id", getUserById);

// UPDATE
// PUT /api/users/:id mijenja podatke postojećeg korisnika.
router.put("/:id", updateUser);

// DELETE
// DELETE /api/users/:id briše korisnika s određenim ID-em.
router.delete("/:id", deleteUser);

// Izvoz rutera omogućuje registraciju u server.js datoteci.
module.exports = router;
