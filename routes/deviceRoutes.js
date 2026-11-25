// Express router sadrži admin uređajske operacije i prijem ESP32 očitanja.
const express = require("express");
const router = express.Router();

// Učitava kontrolere i provjere korisničkih/uređajskih vjerodajnica.
const {
    getDeviceOwner,
    getDeviceConfig,
    getDeviceRawData,
    getAllDevices,
    getMyDevice,
    getMyDeviceReadings,
    getMyTelemetryHistory,
    getUserTelemetryHistory,
    saveMyDeviceSettings,
    saveUserDeviceSettings,
    createDevice,
    updateDeviceToken,
    setDeviceStatus,
    deleteDevice,
    receiveTelemetry
} = require("../controllers/deviceController");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const requireDeviceToken = require("../middleware/deviceAuth");

// Vraća podatke vlasnika tek nakon provjere tokena i MAC adrese uređaja.
router.get("/:macAddress/owner", requireDeviceToken, getDeviceOwner);

// ESP32 periodično preuzima postavke svjetla i temperaturnog releja.
router.get("/:macAddress/config", requireDeviceToken, getDeviceConfig);

// Vraća sirove podatke samo korisnika kojem pripada uređaj iz Bearer serijskog broja.
router.get("/raw", requireDeviceToken, getDeviceRawData);

// ESP32 uređaj koristi token u Bearer zaglavlju za slanje posljednjeg očitanja.
router.post("/telemetry", requireDeviceToken, receiveTelemetry);

// Prijavljeni korisnik smije vidjeti samo uređaj povezan sa svojim računom.
router.get("/mine", requireAuth, getMyDevice);
router.get("/mine/readings", requireAuth, getMyDeviceReadings);
router.get("/mine/history", requireAuth, getMyTelemetryHistory);
router.put("/mine/settings", requireAuth, saveMyDeviceSettings);

// Sve administrativne radnje nad uređajima zahtijevaju admin ulogu.
router.use(requireAuth, requireAdmin);
router.get("/", getAllDevices);
router.post("/", createDevice);
router.get("/users/:userId/readings", getUserTelemetryHistory);
router.put("/users/:userId/settings", saveUserDeviceSettings);
router.put("/:id/token", updateDeviceToken);
router.patch("/:id/status", setDeviceStatus);
router.delete("/:id", deleteDevice);

module.exports = router;
