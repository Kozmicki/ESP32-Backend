// Mongoose povezuje podatke uređaja s korisnikom u MongoDB-u.
const mongoose = require("mongoose");

// Ove postavke spremaju se u bazi i ESP32 ih dohvaća po revision broju.
const controlSettingsSchema = new mongoose.Schema(
    {
        timezone: {
            type: String,
            default: "Europe/Zagreb"
        },
        pollIntervalSeconds: {
            type: Number,
            min: 5,
            max: 3600,
            default: 60
        },
        light: {
            enabled: {
                type: Boolean,
                default: true
            },
            onTime: {
                type: String,
                match: /^([01]\d|2[0-3]):[0-5]\d$/,
                default: "08:00"
            },
            offTime: {
                type: String,
                match: /^([01]\d|2[0-3]):[0-5]\d$/,
                default: "20:00"
            }
        },
        relay: {
            mode: {
                type: String,
                enum: ["heating", "cooling"],
                default: "cooling"
            },
            turnOnTemperatureC: {
                type: Number,
                min: -40,
                max: 100,
                default: 28
            },
            turnOffTemperatureC: {
                type: Number,
                min: -40,
                max: 100,
                default: 25
            }
        }
    },
    { _id: false }
);

// Svakom aktivnom korisniku može pripadati najviše jedan ESP32 uređaj.
const deviceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        // Zadržava postojeći MongoDB naziv polja; vrijednost je tehnička MAC adresa.
        deviceId: {
            type: String,
            required: true,
            unique: true,
            immutable: true
        },

        // Administratorski naziv pomaže razlikovati uređaje u sučelju.
        name: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "ESP32"
        },

        // Serijski broj iz ESP32 koristi se kao Bearer token; sprema se samo njegov hash.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
            select: false
        },

        // Deaktiviran uređaj ne može slati podatke ni nakon valjane provjere tokena.
        isActive: {
            type: Boolean,
            default: true
        },

        // Vrijeme zadnje uspješne poruke i zadnje primljeno JSON očitanje.
        lastSeenAt: {
            type: Date,
            default: null
        },
        latestPayload: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        latestTemperatureC: {
            type: Number,
            default: null
        },
        latestHumidityPercent: {
            type: Number,
            default: null
        },
        // Čuva zadnji postotak vlage tla zasebno za svaku od četiri sonde.
        latestSoilMoisture1Percent: {
            type: Number,
            default: null
        },
        latestSoilMoisture2Percent: {
            type: Number,
            default: null
        },
        latestSoilMoisture3Percent: {
            type: Number,
            default: null
        },
        latestSoilMoisture4Percent: {
            type: Number,
            default: null
        },
        controlSettings: {
            type: controlSettingsSchema,
            default: () => ({})
        },
        settingsRevision: {
            type: Number,
            default: 1
        },
        settingsUpdatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Javno API polje ima jasan naziv, dok stari MongoDB dokumenti zadržavaju kompatibilnost.
deviceSchema.virtual("macAddress")
    .get(function getMacAddress() {
        return this.deviceId;
    })
    .set(function setMacAddress(value) {
        this.deviceId = value;
    });

// Jedinstveni korisnički indeks jamči odnos jedan korisnik — jedan uređaj.
const Device = mongoose.model("Device", deviceSchema);

module.exports = Device;
