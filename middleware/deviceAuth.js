// Koristi SHA-256 za usporedbu tokena bez spremanja tokena u čitljivom obliku.
const crypto = require("node:crypto");

// Učitava model uređaja radi provjere vjerodajnice.
const Device = require("../models/Device");
const normalizeDeviceSerial = require("../utils/deviceSerial");

// Autorizira zahtjev serijskim brojem uređaja u Authorization: Bearer zaglavlju.
const requireDeviceToken = async (req, res, next) => {
    const authorization = req.get("authorization") || "";
    const tokenMatch = authorization.match(/^Bearer (\S+)$/);
    const serialNumber = normalizeDeviceSerial(tokenMatch?.[1]);

    if (!serialNumber) {
        return res.status(401).json({
            success: false,
            message: "Nedostaje ili nije ispravan serijski token uređaja"
        });
    }

    try {
        // Sažetak se traži u bazi; serijski token nikad se ne sprema kao čitljiv tekst.
        const tokenHash = crypto
            .createHash("sha256")
            .update(serialNumber)
            .digest("hex");

        const device = await Device.findOne({
            tokenHash,
            isActive: true
        }).populate({
            path: "user",
            select: "name email role isActive"
        });

        // Deaktiviran korisnik automatski gubi pristup i sa svog ESP32 uređaja.
        if (!device || !device.user || !device.user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Token uređaja nije valjan ili je uređaj deaktiviran"
            });
        }

        // Kontroler koristi provjereni uređaj i vlasnika za spremanje očitanja.
        req.device = device;
        return next();
    } catch (error) {
        return next(error);
    }
};

module.exports = requireDeviceToken;
