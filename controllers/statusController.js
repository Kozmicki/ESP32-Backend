// Mongoose pokazuje trenutno stanje veze s MongoDB bazom.
const mongoose = require("mongoose");

// Vraća siguran pregled servera i baze za administratorsku statusnu stranicu.
const getServerStatus = (req, res) => {
    const databaseStates = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };
    const databaseState = databaseStates[mongoose.connection.readyState] || "unknown";
    const isDatabaseConnected = databaseState === "connected";

    return res.status(isDatabaseConnected ? 200 : 503).json({
        success: isDatabaseConnected,
        data: {
            server: {
                status: "online",
                uptimeSeconds: Math.floor(process.uptime()),
                nodeVersion: process.version
            },
            database: {
                status: databaseState
            },
            checkedAt: new Date().toISOString()
        }
    });
};

module.exports = getServerStatus;
