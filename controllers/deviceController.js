// Dohvaća modele za uređaje i korisnike.
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Device = require("../models/Device");
const User = require("../models/User");
const TelemetryReading = require("../models/TelemetryReading");
const normalizeMacAddress = require("../utils/macAddress");
const normalizeDeviceSerial = require("../utils/deviceSerial");
const { sendDeviceNotification } = require("../utils/email");

const CONTROL_TIMEZONE = "Europe/Zagreb";
const CONFIG_POLL_INTERVAL_SECONDS = 60;
const TELEMETRY_INTERVAL_MS = 60 * 60 * 1000;
const TELEMETRY_RETENTION_SAMPLES = 30 * 24;

const notifyDeviceOwner = async (user, device, event) => {
    if (!user?.email) {
        console.error("Email obavijest za uređaj nije poslana: vlasnik nema email adresu");
        return false;
    }

    try {
        await sendDeviceNotification({
            name: user.name,
            email: user.email,
            deviceName: device.name,
            macAddress: device.macAddress || device.deviceId,
            event
        });
        return true;
    } catch (error) {
        console.error("Email obavijest za uređaj nije poslana:", error.message);
        return false;
    }
};

// Dohvaća zajednički satni uzorak za administratore i vlasnika uređaja.
const buildTelemetryHistory = async (device, after) => {
    const endAt = Math.floor(Date.now() / TELEMETRY_INTERVAL_MS) * TELEMETRY_INTERVAL_MS;
    const startAt = endAt - (TELEMETRY_RETENTION_SAMPLES - 1) * TELEMETRY_INTERVAL_MS;
    let queryStartAt = startAt;

    if (after !== undefined) {
        const requestedAfter = typeof after === "string" ? Date.parse(after) : Number.NaN;

        if (!Number.isFinite(requestedAfter)) {
            return { error: "Vrijeme od kojeg se dohvaćaju uzorci nije ispravno" };
        }

        queryStartAt = Math.max(
            startAt,
            Math.min(endAt, Math.floor(requestedAfter / TELEMETRY_INTERVAL_MS) * TELEMETRY_INTERVAL_MS)
        );
    }

    const storedSamples = await TelemetryReading.find({
        device: device._id,
        sampledAt: {
            $gte: new Date(queryStartAt),
            $lte: new Date(endAt)
        }
    })
        .sort({ sampledAt: 1 })
        .select(
            "sampledAt temperatureC humidityPercent soilMoisture1Percent soilMoisture2Percent soilMoisture3Percent soilMoisture4Percent -_id"
        )
        .lean();
    const samples = storedSamples.filter(
        sample => new Date(sample.sampledAt).getTime() % TELEMETRY_INTERVAL_MS === 0
    );

    return {
        data: {
            macAddress: device.macAddress || device.deviceId,
            intervalSeconds: TELEMETRY_INTERVAL_MS / 1000,
            retentionDays: 30,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            samples
        }
    };
};

// Provjerava postavke i vraća zajednički oblik koji spremaju korisnik i administrator.
const validateControlSettings = (body) => {
    const { light, relay } = body || {};
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (
        !light ||
        typeof light.enabled !== "boolean" ||
        typeof light.onTime !== "string" ||
        typeof light.offTime !== "string" ||
        !timePattern.test(light.onTime) ||
        !timePattern.test(light.offTime) ||
        light.onTime === light.offTime
    ) {
        return {
            error: "Unesite različita i ispravna vremena paljenja i gašenja svjetla"
        };
    }

    if (
        !relay ||
        !["heating", "cooling"].includes(relay.mode) ||
        !Number.isFinite(relay.turnOnTemperatureC) ||
        !Number.isFinite(relay.turnOffTemperatureC) ||
        relay.turnOnTemperatureC < -40 ||
        relay.turnOnTemperatureC > 100 ||
        relay.turnOffTemperatureC < -40 ||
        relay.turnOffTemperatureC > 100
    ) {
        return {
            error: "Unesite ispravne temperaturne pragove između -40 i 100 °C"
        };
    }

    const validThresholdOrder = relay.mode === "cooling"
        ? relay.turnOnTemperatureC > relay.turnOffTemperatureC
        : relay.turnOnTemperatureC < relay.turnOffTemperatureC;

    if (!validThresholdOrder) {
        return {
            error: relay.mode === "cooling"
                ? "Kod hlađenja temperatura uključivanja mora biti viša od temperature isključivanja"
                : "Kod grijanja temperatura uključivanja mora biti niža od temperature isključivanja"
        };
    }

    return {
        settings: {
            timezone: CONTROL_TIMEZONE,
            pollIntervalSeconds: CONFIG_POLL_INTERVAL_SECONDS,
            light: {
                enabled: light.enabled,
                onTime: light.onTime,
                offTime: light.offTime
            },
            relay: {
                mode: relay.mode,
                turnOnTemperatureC: relay.turnOnTemperatureC,
                turnOffTemperatureC: relay.turnOffTemperatureC
            }
        }
    };
};

// Vraća sigurne podatke uređaja bez tokena ili njegova hash-a.
const toPublicDevice = (device) => ({
    id: device._id,
    macAddress: device.macAddress || device.deviceId,
    name: device.name,
    user: device.user,
    isActive: device.isActive,
    lastSeenAt: device.lastSeenAt,
    latestPayload: device.isActive ? device.latestPayload : null,
    latestTemperatureC: device.isActive ? device.latestTemperatureC : null,
    latestHumidityPercent: device.isActive ? device.latestHumidityPercent : null,
    latestSoilMoisture1Percent: device.isActive ? device.latestSoilMoisture1Percent : null,
    latestSoilMoisture2Percent: device.isActive ? device.latestSoilMoisture2Percent : null,
    latestSoilMoisture3Percent: device.isActive ? device.latestSoilMoisture3Percent : null,
    latestSoilMoisture4Percent: device.isActive ? device.latestSoilMoisture4Percent : null,
    controlSettings: device.controlSettings,
    settingsRevision: device.settingsRevision,
    settingsUpdatedAt: device.settingsUpdatedAt,
    createdAt: device.createdAt
});

// Provjerava da je MAC u URL-u isti kao onaj vezan uz tajni token.
const requireMatchingMacAddress = (req, res) => {
    const requestedMac = normalizeMacAddress(req.params.macAddress);

    if (!requestedMac || requestedMac !== (req.device.macAddress || req.device.deviceId)) {
        res.status(403).json({
            success: false,
            message: "MAC adresa ne odgovara autentificiranom uređaju"
        });
        return false;
    }

    return true;
};

// ESP32 dobiva osnovne javne podatke samo o korisniku kojem pripada.
const getDeviceOwner = (req, res) => {
    // Token i MAC moraju pripadati istom uređaju kako bi se spriječila zabuna.
    if (!requireMatchingMacAddress(req, res)) return;

    const owner = req.device.user;

    return res.status(200).json({
        success: true,
        data: {
            macAddress: req.device.macAddress || req.device.deviceId,
            user: {
                id: owner._id,
                name: owner.name,
                email: owner.email,
                role: owner.role,
                isActive: owner.isActive
            }
        }
    });
};

// ESP32 preuzima najnoviju spremljenu konfiguraciju i njezin revision broj.
const getDeviceConfig = (req, res) => {
    if (!requireMatchingMacAddress(req, res)) return;

    return res.status(200).json({
        success: true,
        data: {
            macAddress: req.device.macAddress || req.device.deviceId,
            revision: req.device.settingsRevision,
            updatedAt: req.device.settingsUpdatedAt,
            settings: req.device.controlSettings
        }
    });
};

// Vraća sirove JSON podatke korisnika kojem pripada uređaj autentificiran serijskim brojem.
const getDeviceRawData = async (req, res, next) => {
    try {
        const user = await User.findById(req.device.user._id)
            .select("name email role isActive createdAt updatedAt");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Vlasnik ESP32 uređaja nije pronađen"
            });
        }

        const history = await buildTelemetryHistory(req.device);
        if (history.error) {
            return res.status(400).json({ success: false, message: history.error });
        }

        return res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            device: {
                id: req.device._id,
                macAddress: req.device.macAddress || req.device.deviceId,
                name: req.device.name,
                isActive: req.device.isActive,
                lastSeenAt: req.device.lastSeenAt,
                latestReadings: {
                    temperatureC: req.device.latestTemperatureC ?? null,
                    humidityPercent: req.device.latestHumidityPercent ?? null,
                    soilMoisture1Percent: req.device.latestSoilMoisture1Percent ?? null,
                    soilMoisture2Percent: req.device.latestSoilMoisture2Percent ?? null,
                    soilMoisture3Percent: req.device.latestSoilMoisture3Percent ?? null,
                    soilMoisture4Percent: req.device.latestSoilMoisture4Percent ?? null
                },
                controlSettings: req.device.controlSettings,
                settingsRevision: req.device.settingsRevision,
                settingsUpdatedAt: req.device.settingsUpdatedAt
            },
            telemetryHistory: history.data
        });
    } catch (error) {
        return next(error);
    }
};

// Adminu vraća sve uređaje i podatke njihovih vlasnika.
const getAllDevices = async (req, res, next) => {
    try {
        const devices = await Device.find()
            .sort({ createdAt: -1 })
            .populate("user", "name email isActive");

        return res.status(200).json({
            success: true,
            count: devices.length,
            data: devices.map(toPublicDevice)
        });
    } catch (error) {
        return next(error);
    }
};

// Prijavljenom korisniku vraća samo njegov uređaj, ako mu je dodijeljen.
const getMyDevice = async (req, res, next) => {
    try {
        const device = await Device.findOne({ user: req.user._id })
            .select("-tokenHash");

        return res.status(200).json({
            success: true,
            data: device ? toPublicDevice(device) : null
        });
    } catch (error) {
        return next(error);
    }
};

// Korisnički dashboard periodično poziva ovu rutu za zadnja očitanja senzora.
const getMyDeviceReadings = async (req, res, next) => {
    try {
        const device = await Device.findOne({ user: req.user._id })
            .select(
                "deviceId name isActive lastSeenAt latestTemperatureC latestHumidityPercent latestSoilMoisture1Percent latestSoilMoisture2Percent latestSoilMoisture3Percent latestSoilMoisture4Percent"
            );

        return res.status(200).json({
            success: true,
            data: device ? {
                macAddress: device.macAddress || device.deviceId,
                name: device.name,
                isActive: device.isActive,
                lastSeenAt: device.lastSeenAt,
                temperatureC: device.isActive ? device.latestTemperatureC : null,
                humidityPercent: device.isActive ? device.latestHumidityPercent : null,
                soilMoisture1Percent: device.isActive ? device.latestSoilMoisture1Percent : null,
                soilMoisture2Percent: device.isActive ? device.latestSoilMoisture2Percent : null,
                soilMoisture3Percent: device.isActive ? device.latestSoilMoisture3Percent : null,
                soilMoisture4Percent: device.isActive ? device.latestSoilMoisture4Percent : null
            } : null
        });
    } catch (error) {
        return next(error);
    }
};

// Vraća satnu povijest samo za uređaj korisnika iz trenutačne sesije.
const getMyTelemetryHistory = async (req, res, next) => {
    try {
        const device = await Device.findOne({ user: req.user._id })
            .select("_id deviceId isActive");

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "Vašem računu nije dodijeljen ESP32 uređaj"
            });
        }

        if (!device.isActive) {
            return res.status(403).json({
                success: false,
                message: "Povijest očitanja nije dostupna jer je uređaj deaktiviran"
            });
        }

        const history = await buildTelemetryHistory(device, req.query?.after);
        if (history.error) {
            return res.status(400).json({ success: false, message: history.error });
        }

        return res.status(200).json({
            success: true,
            data: history.data
        });
    } catch (error) {
        return next(error);
    }
};

// Administrator dohvaća do 30 dana satnih očitanja odabranog korisnika.
const getUserTelemetryHistory = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({
                success: false,
                message: "ID korisnika nije ispravan"
            });
        }

        const device = await Device.findOne({ user: req.params.userId })
            .select("_id deviceId isActive");

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "Korisniku nije dodijeljen ESP32 uređaj"
            });
        }

        if (!device.isActive) {
            return res.status(403).json({
                success: false,
                message: "Povijest očitanja nije dostupna jer je uređaj deaktiviran"
            });
        }

        const history = await buildTelemetryHistory(device, req.query?.after);
        if (history.error) {
            return res.status(400).json({ success: false, message: history.error });
        }

        return res.status(200).json({
            success: true,
            data: history.data
        });
    } catch (error) {
        return next(error);
    }
};

// Validira i sprema raspored svjetla te temperaturne pragove releja.
const saveMyDeviceSettings = async (req, res, next) => {
    try {
        const { settings, error } = validateControlSettings(req.body);

        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const device = await Device.findOneAndUpdate(
            { user: req.user._id, isActive: true },
            {
                $set: {
                    controlSettings: settings,
                    settingsUpdatedAt: new Date()
                },
                $inc: {
                    settingsRevision: 1
                }
            },
            { returnDocument: "after", runValidators: true }
        ).select("controlSettings settingsRevision settingsUpdatedAt deviceId");

        if (!device) {
            const assignedDevice = await Device.exists({ user: req.user._id });
            if (assignedDevice) {
                return res.status(409).json({
                    success: false,
                    message: "Postavke se ne mogu mijenjati dok je uređaj deaktiviran"
                });
            }

            return res.status(404).json({
                success: false,
                message: "Ovom korisniku nije dodijeljen ESP32 uređaj"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Postavke su spremljene; ESP32 će ih preuzeti pri sljedećoj provjeri",
            data: {
                macAddress: device.macAddress || device.deviceId,
                revision: device.settingsRevision,
                updatedAt: device.settingsUpdatedAt,
                settings: device.controlSettings
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Administrator sprema raspored i temperaturne pragove uređaja određenog korisnika.
const saveUserDeviceSettings = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return res.status(400).json({
                success: false,
                message: "ID korisnika nije ispravan"
            });
        }

        const { settings, error } = validateControlSettings(req.body);

        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const device = await Device.findOneAndUpdate(
            { user: req.params.userId, isActive: true },
            {
                $set: {
                    controlSettings: settings,
                    settingsUpdatedAt: new Date()
                },
                $inc: {
                    settingsRevision: 1
                }
            },
            { returnDocument: "after", runValidators: true }
        ).select("controlSettings settingsRevision settingsUpdatedAt deviceId");

        if (!device) {
            const assignedDevice = await Device.exists({ user: req.params.userId });
            if (assignedDevice) {
                return res.status(409).json({
                    success: false,
                    message: "Postavke se ne mogu mijenjati dok je uređaj deaktiviran"
                });
            }

            return res.status(404).json({
                success: false,
                message: "Korisniku nije dodijeljen ESP32 uređaj"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Postavke uređaja su spremljene",
            data: {
                macAddress: device.macAddress || device.deviceId,
                revision: device.settingsRevision,
                updatedAt: device.settingsUpdatedAt,
                settings: device.controlSettings
            }
        });
    } catch (error) {
        return next(error);
    }
};

// Admin dodjeljuje jedan novi ESP32 uređaj odabranom korisniku.
const createDevice = async (req, res, next) => {
    try {
        const { userId, macAddress, serialNumber, name } = req.body || {};

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Odaberite ispravnog korisnika"
            });
        }

        const normalizedMac = normalizeMacAddress(macAddress);

        if (!normalizedMac) {
            return res.status(400).json({
                success: false,
                message: "Unesite ispravnu ESP32 MAC adresu, npr. AA:BB:CC:DD:EE:FF"
            });
        }

        const normalizedSerial = normalizeDeviceSerial(serialNumber);

        if (!normalizedSerial) {
            return res.status(400).json({
                success: false,
                message: "Serijski token mora sadržavati točno 64 heksadekadska znaka"
            });
        }

        if (name !== undefined && (typeof name !== "string" || name.trim().length > 100)) {
            return res.status(400).json({
                success: false,
                message: "Naziv uređaja mora imati najviše 100 znakova"
            });
        }

        const user = await User.findById(userId).select("name email isActive");

        if (!user || !user.isActive) {
            return res.status(404).json({
                success: false,
                message: "Korisnik nije pronađen ili je deaktiviran"
            });
        }

        const tokenHash = crypto.createHash("sha256").update(normalizedSerial).digest("hex");

        if (await Device.exists({ tokenHash })) {
            return res.status(409).json({
                success: false,
                message: "Ovaj serijski token već je dodijeljen drugom ESP32 uređaju"
            });
        }

        // Provjera daje razumljivu poruku, a jedinstveni indeks štiti i od utrke.
        if (await Device.exists({ user: user._id })) {
            return res.status(409).json({
                success: false,
                message: "Ovaj korisnik već ima dodijeljen ESP32 uređaj"
            });
        }

        const device = await Device.create({
            user: user._id,
            // Staro MongoDB polje deviceId čuva MAC kao tehnički podatak.
            deviceId: normalizedMac,
            name: name?.trim() || "ESP32",
            tokenHash
        });
        const emailAccepted = await notifyDeviceOwner(user, device, "assigned");

        // Serijski token se ne vraća u odgovoru jer je već ugrađen u ESP32.
        return res.status(201).json({
            success: true,
            message: emailAccepted
                ? "ESP32 uređaj dodijeljen je korisniku, a SMTP poslužitelj prihvatio je email obavijest"
                : "ESP32 uređaj dodijeljen je korisniku, ali email obavijest nije poslana",
            emailAccepted,
            data: toPublicDevice({ ...device.toObject(), user })
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "MAC, serijski token ili korisnik već su povezani s drugim uređajem"
            });
        }

        return next(error);
    }
};

// Ažurira Bearer vjerodajnicu na serijski broj koji je ugrađen u novi firmware.
const updateDeviceToken = async (req, res, next) => {
    try {
        const normalizedSerial = normalizeDeviceSerial(req.body?.serialNumber);

        if (!normalizedSerial) {
            return res.status(400).json({
                success: false,
                message: "Serijski token mora sadržavati točno 64 heksadekadska znaka"
            });
        }

        const tokenHash = crypto.createHash("sha256").update(normalizedSerial).digest("hex");
        const tokenAlreadyAssigned = await Device.exists({
            tokenHash,
            _id: { $ne: req.params.id }
        });

        if (tokenAlreadyAssigned) {
            return res.status(409).json({
                success: false,
                message: "Ovaj serijski token već je dodijeljen drugom ESP32 uređaju"
            });
        }

        const deviceBeforeUpdate = await Device.findById(req.params.id).select("isActive");
        if (!deviceBeforeUpdate) {
            return res.status(404).json({
                success: false,
                message: "ESP32 uređaj nije pronađen"
            });
        }

        const becameActive = !deviceBeforeUpdate.isActive;
        const device = await Device.findByIdAndUpdate(
            req.params.id,
            {
                tokenHash,
                isActive: true
            },
            { returnDocument: "after", runValidators: true }
        ).select("-tokenHash").populate("user", "name email isActive");

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "ESP32 uređaj nije pronađen"
            });
        }

        const emailAccepted = becameActive
            ? await notifyDeviceOwner(device.user, device, "activated")
            : undefined;

        return res.status(200).json({
            success: true,
            message: becameActive
                ? emailAccepted
                    ? "Serijski token je ažuriran, uređaj aktiviran i SMTP poslužitelj prihvatio je email obavijest"
                    : "Serijski token je ažuriran i uređaj aktiviran, ali email obavijest nije poslana"
                : "Serijski token je ažuriran; stari token više ne vrijedi",
            ...(emailAccepted !== undefined && { emailAccepted }),
            data: toPublicDevice(device)
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Ovaj serijski token već je povezan s drugim uređajem"
            });
        }

        return next(error);
    }
};

// Aktivira ili deaktivira uređaj bez brisanja njegove veze s korisnikom.
const setDeviceStatus = async (req, res, next) => {
    try {
        const { isActive } = req.body || {};

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Status uređaja mora biti true ili false"
            });
        }

        let device = await Device.findOneAndUpdate(
            {
                _id: req.params.id,
                isActive: { $ne: isActive }
            },
            { isActive },
            { returnDocument: "after", runValidators: true }
        ).select("-tokenHash").populate("user", "name email isActive");
        const statusChanged = Boolean(device);

        if (!device) {
            device = await Device.findById(req.params.id)
                .select("-tokenHash")
                .populate("user", "name email isActive");
        }

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "ESP32 uređaj nije pronađen"
            });
        }

        const emailAccepted = statusChanged
            ? await notifyDeviceOwner(
                device.user,
                device,
                isActive ? "activated" : "deactivated"
            )
            : undefined;

        return res.status(200).json({
            success: true,
            message: statusChanged
                ? emailAccepted
                    ? `${isActive ? "Uređaj je aktiviran" : "Uređaj je deaktiviran"}; SMTP poslužitelj prihvatio je email obavijest`
                    : `${isActive ? "Uređaj je aktiviran" : "Uređaj je deaktiviran"}, ali email obavijest nije poslana`
                : `Uređaj je već ${isActive ? "aktivan" : "deaktiviran"}`,
            ...(emailAccepted !== undefined && { emailAccepted }),
            data: toPublicDevice(device)
        });
    } catch (error) {
        return next(error);
    }
};

// Briše uređaj i njegov posljednji spremljeni payload iz sustava.
const deleteDevice = async (req, res, next) => {
    try {
        const device = await Device.findByIdAndDelete(req.params.id);

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "ESP32 uređaj nije pronađen"
            });
        }

        await TelemetryReading.deleteMany({ device: device._id });

        return res.status(200).json({
            success: true,
            message: "ESP32 uređaj je uklonjen"
        });
    } catch (error) {
        return next(error);
    }
};

// Sprema temperaturu, vlagu zraka i četiri očitanja vlage tla s autentificiranog uređaja.
const receiveTelemetry = async (req, res, next) => {
    try {
        const payload = req.body;

        if (
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload) ||
            !Number.isFinite(payload.temperatureC) ||
            !Number.isFinite(payload.humidityPercent) ||
            !Number.isFinite(payload.soilMoisture1Percent) ||
            !Number.isFinite(payload.soilMoisture2Percent) ||
            !Number.isFinite(payload.soilMoisture3Percent) ||
            !Number.isFinite(payload.soilMoisture4Percent) ||
            payload.temperatureC < -40 ||
            payload.temperatureC > 100 ||
            payload.humidityPercent < 0 ||
            payload.humidityPercent > 100 ||
            payload.soilMoisture1Percent < 0 ||
            payload.soilMoisture1Percent > 100 ||
            payload.soilMoisture2Percent < 0 ||
            payload.soilMoisture2Percent > 100 ||
            payload.soilMoisture3Percent < 0 ||
            payload.soilMoisture3Percent > 100 ||
            payload.soilMoisture4Percent < 0 ||
            payload.soilMoisture4Percent > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Pošaljite temperaturu (-40 do 100 °C), vlagu zraka (0 do 100 %) i sve četiri vrijednosti vlage tla (svaka 0 do 100 %)"
            });
        }

        if (Buffer.byteLength(JSON.stringify(payload), "utf8") > 32 * 1024) {
            return res.status(413).json({
                success: false,
                message: "Očitanje je preveliko; najveća veličina je 32 KB"
            });
        }

        const receivedAt = new Date();
        const sampledAt = new Date(
            Math.floor(receivedAt.getTime() / TELEMETRY_INTERVAL_MS) * TELEMETRY_INTERVAL_MS
        );
        const readingFilter = {
            device: req.device._id,
            sampledAt
        };
        const readingUpdate = {
            $set: {
                temperatureC: payload.temperatureC,
                humidityPercent: payload.humidityPercent,
                soilMoisture1Percent: payload.soilMoisture1Percent,
                soilMoisture2Percent: payload.soilMoisture2Percent,
                soilMoisture3Percent: payload.soilMoisture3Percent,
                soilMoisture4Percent: payload.soilMoisture4Percent
            },
            $setOnInsert: readingFilter
        };

        const device = await Device.findOneAndUpdate(
            { _id: req.device._id, isActive: true },
            {
                lastSeenAt: receivedAt,
                latestPayload: {
                    temperatureC: payload.temperatureC,
                    humidityPercent: payload.humidityPercent,
                    soilMoisture1Percent: payload.soilMoisture1Percent,
                    soilMoisture2Percent: payload.soilMoisture2Percent,
                    soilMoisture3Percent: payload.soilMoisture3Percent,
                    soilMoisture4Percent: payload.soilMoisture4Percent
                },
                latestTemperatureC: payload.temperatureC,
                latestHumidityPercent: payload.humidityPercent,
                latestSoilMoisture1Percent: payload.soilMoisture1Percent,
                latestSoilMoisture2Percent: payload.soilMoisture2Percent,
                latestSoilMoisture3Percent: payload.soilMoisture3Percent,
                latestSoilMoisture4Percent: payload.soilMoisture4Percent
            },
            { returnDocument: "after" }
        ).select("deviceId user");

        if (!device) {
            return res.status(401).json({
                success: false,
                message: "ESP32 uređaj više nije aktivan"
            });
        }

        // Pohranjuje posljednji uzorak zaprimljen u ovom satu, bez dupliciranja.
        try {
            await TelemetryReading.updateOne(
                readingFilter,
                readingUpdate,
                { upsert: true, runValidators: true }
            );
        } catch (error) {
            // Rukuje istodobnim zahtjevima uređaja koji pokušaju stvoriti isti sat.
            if (error.code !== 11000) throw error;

            await TelemetryReading.updateOne(
                readingFilter,
                { $set: readingUpdate.$set },
                { runValidators: true }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Očitanje je zaprimljeno",
            data: {
                macAddress: device.macAddress || device.deviceId,
                receivedAt
            }
        });
    } catch (error) {
        return next(error);
    }
};

module.exports = {
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
};
