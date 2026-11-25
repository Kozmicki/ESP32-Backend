// Mongoose sprema satna očitanja senzora odvojeno od trenutnog stanja uređaja.
const mongoose = require("mongoose");

const RETENTION_SECONDS = 30 * 24 * 60 * 60;

const telemetryReadingSchema = new mongoose.Schema(
    {
        device: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Device",
            required: true
        },
        sampledAt: {
            type: Date,
            required: true
        },
        temperatureC: {
            type: Number,
            required: true,
            min: -40,
            max: 100
        },
        humidityPercent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        // Svaki satni uzorak uključuje i postotke vlage tla za sve četiri sonde.
        soilMoisture1Percent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        soilMoisture2Percent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        soilMoisture3Percent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        soilMoisture4Percent: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        }
    },
    {
        versionKey: false
    }
);

// U satu se čuva jedno očitanje po uređaju, a MongoDB briše podatke nakon 30 dana.
telemetryReadingSchema.index({ device: 1, sampledAt: 1 }, { unique: true });
telemetryReadingSchema.index({ sampledAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

module.exports = mongoose.model("TelemetryReading", telemetryReadingSchema);
