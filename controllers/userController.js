
// Mongoose model kojim se čitaju i spremaju korisnici u MongoDB.
const User = require("../models/User");
// Model uređaja potreban je da se spriječi brisanje korisnika s dodijeljenim ESP32.
const Device = require("../models/Device");

// bcryptjs šifrira lozinke prije spremanja u bazu.
const bcrypt = require("bcryptjs");
const { sendUserWelcomeEmail } = require("../utils/email");

// CREATE USER
// Kreira novog korisnika i obrađuje prijavljene greške.
const createUser = async (req, res, next) => {
    try {
        // Uzima samo javne podatke obrasca; uloga se dodjeljuje na serveru.
        const { name, email, password } = req.body || {};

        // Provjerava da su sva obavezna polja tekst i da nisu prazna.
        if (
            typeof name !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string" ||
            !name.trim() ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Ime, email i lozinka su obavezni"
            });
        }

        const normalizedName = name.trim();
        const normalizedEmail = email.trim().toLowerCase();

        // Jednostavna provjera formata email adrese prije pristupa bazi.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Unesite ispravnu email adresu"
            });
        }

        // Primjenjuje minimalnu sigurnosnu duljinu lozinke.
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Lozinka mora imati najmanje 8 znakova"
            });
        }

        // Normalizira email i provjerava postoji li već korisnik s njime.
        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        // Status 409 označuje da resurs već postoji.
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Korisnik s ovim emailom već postoji"
            });
        }

        // 12 je broj sigurnosnih krugova hashiranja lozinke.
        const hashedPassword = await bcrypt.hash(password, 12);

        // Stvara korisnika u MongoDB bazi.
        const user = await User.create({
            name: normalizedName,
            email: normalizedEmail,
            password: hashedPassword
        });

        let emailSent = false;
        try {
            await sendUserWelcomeEmail({
                name: normalizedName,
                email: normalizedEmail,
                password
            });
            emailSent = true;
        } catch (emailError) {
            console.error("Korisnički račun je kreiran, ali aktivacijski email nije poslan:", emailError.message);
        }

        // Vraća samo javne podatke, nikada hash lozinke.
        res.status(201).json({
            success: true,
            message: emailSent
                ? "Korisnik uspješno kreiran i aktivacijski email je poslan"
                : "Korisnik uspješno kreiran, ali aktivacijski email nije poslan",
            emailSent,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        // Duplikat emaila može se uhvatiti i kroz MongoDB grešku.
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email je već zauzet"
            });
        }

        // Ostale greške prosljeđuje centralnom error handleru.
        next(error);
    }
};


// GET ALL USERS
// Dohvaća sve korisnike, najnovije prvo.
const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });

        // count prikazuje broj korisnika, a data njihove podatke.
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });

    } catch (error) {
        // Prosljeđuje pogrešku centralnom handleru.
        next(error);
    }
};


// GET SINGLE USER
// Dohvaća jednog korisnika prema MongoDB ID-u iz URL-a.
const getUserById = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        // Provjerava je li korisnik s traženim ID-em pronađen.
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Korisnik nije pronađen"
            });
        }

        // Dohvaća samo prikazive podatke ESP32 uređaja povezanog s korisnikom.
        const device = await Device.findOne({ user: user._id })
            .select(
                "deviceId name isActive lastSeenAt latestTemperatureC latestHumidityPercent latestSoilMoisture1Percent latestSoilMoisture2Percent latestSoilMoisture3Percent latestSoilMoisture4Percent controlSettings settingsRevision settingsUpdatedAt"
            );

        // Vraća detalje računa i uređaja bez lozinke ili tokena.
        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                device: device ? {
                    macAddress: device.macAddress || device.deviceId,
                    name: device.name,
                    isActive: device.isActive,
                    lastSeenAt: device.lastSeenAt,
                    temperatureC: device.isActive ? device.latestTemperatureC : null,
                    humidityPercent: device.isActive ? device.latestHumidityPercent : null,
                    soilMoisture1Percent: device.isActive ? device.latestSoilMoisture1Percent : null,
                    soilMoisture2Percent: device.isActive ? device.latestSoilMoisture2Percent : null,
                    soilMoisture3Percent: device.isActive ? device.latestSoilMoisture3Percent : null,
                    soilMoisture4Percent: device.isActive ? device.latestSoilMoisture4Percent : null,
                    controlSettings: device.isActive ? device.controlSettings : null,
                    settingsRevision: device.isActive ? device.settingsRevision : null,
                    settingsUpdatedAt: device.isActive ? device.settingsUpdatedAt : null
                } : null
            }
        });

    } catch (error) {
        next(error);
    }
};


// UPDATE USER
// Ažurira korisnika samo prema poljima koja su poslana u zahtjev.
const updateUser = async (req, res, next) => {
    try {
        const { name, email, password, role, isActive } = req.body || {};

        // Prazan objekt sprema samo stvarno promijenjena polja.
        const updates = {};

        // undefined znači da polje nije poslano u zahtjev.
        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Ime ne smije biti prazno"
                });
            }

            updates.name = name.trim();
        }

        if (email !== undefined) {
            if (typeof email !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Unesite ispravnu email adresu"
                });
            }

            const normalizedEmail = email.trim().toLowerCase();

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
                return res.status(400).json({
                    success: false,
                    message: "Unesite ispravnu email adresu"
                });
            }

            updates.email = normalizedEmail;
        }

        if (role !== undefined) updates.role = role;

        if (isActive !== undefined) {
            if (typeof isActive !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "Status korisnika nije ispravan"
                });
            }

            updates.isActive = isActive;
        }

        // Ako se šalje lozinka, provjerava se i ponovno šifrira.
        if (password !== undefined) {
            if (typeof password !== "string" || password.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "Lozinka mora imati najmanje 8 znakova"
                });
            }

            updates.password = await bcrypt.hash(password, 12);
        }

        // Sprječava poziv ažuriranja bez ikakvih podataka.
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Nema podataka za ažuriranje"
            });
        }

        // Vraća ažurirani dokument; runValidators provjerava pravila modela.
        const user = await User.findByIdAndUpdate(
            req.params.id,
            updates,
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        // Provjerava postoji li korisnik koji se ažurira.
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Korisnik nije pronađen"
            });
        }

        // Vraća ažurirani korisnički dokument.
        res.status(200).json({
            success: true,
            message: "Korisnik uspješno ažuriran",
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });

    } catch (error) {
        // Duplikat emaila vraća jasnu HTTP grešku.
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email je već zauzet"
            });
        }

        next(error);
    }
};


// DELETE USER
// Briše korisnika prema ID-u iz URL parametra.
const deleteUser = async (req, res, next) => {
    try {
        // Sprječava uklanjanje vlasnika dok mu je ESP32 još uvijek dodijeljen.
        if (await Device.exists({ user: req.params.id })) {
            return res.status(409).json({
                success: false,
                message: "Korisnik ima dodijeljen ESP32. Uklonite uređaj prije brisanja korisnika."
            });
        }

        const user = await User.findByIdAndDelete(req.params.id);

        // Provjerava je li doista obrisan neki korisnik.
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Korisnik nije pronađen"
            });
        }

        // HTTP 200 potvrđuje uspješno brisanje.
        res.status(200).json({
            success: true,
            message: "Korisnik uspješno obrisan"
        });

    } catch (error) {
        next(error);
    }
};


// Izvozi sve funkcije koje se registriraju kao API rute.
module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
};
