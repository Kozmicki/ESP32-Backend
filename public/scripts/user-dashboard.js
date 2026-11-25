const userDailyMessage = "Svaki dan donosi novu priliku za dobru ideju.";

// Dohvaća elemente za očitanja, postavke i poruke.
const dashboardMessage = document.getElementById("dashboard-message");
const settingsMessage = document.getElementById("settings-message");
const settingsForm = document.getElementById("device-settings-form");
const settingsFields = document.getElementById("device-settings-fields");
const saveSettingsButton = document.getElementById("save-device-settings");
const deviceSettingsCard = document.getElementById("device-settings-card");
const settingsUnavailableMessage = document.getElementById("settings-unavailable-message");
const adminOwnDeviceSection = document.getElementById("admin-own-device");
const adminOwnDeviceLink = document.getElementById("admin-own-device-link");
const deviceStatus = document.getElementById("device-status");
const deviceReadingsSection = document.getElementById("device-readings-section");
const telemetryHistoryCard = document.getElementById("telemetry-history-card");
const historyUnavailableMessage = document.getElementById("history-unavailable-message");
const telemetryHistoryMessage = document.getElementById("telemetry-history-message");
const historyPage = document.getElementById("history-page");
const historyTab = document.getElementById("history-tab");
let hasAssignedDevice = false;
let isDeviceActive = false;
let userTelemetryChart = null;
let historyRefreshTimer = null;
let historyRequestId = 0;

// Prikazuje poruku iz API-ja bez umetanja sadržaja kao HTML-a.
const showSettingsMessage = (message, type) => {
    settingsMessage.textContent = message;
    settingsMessage.className = `alert alert-${type}`;
};

// Objašnjava različite pragove releja ovisno o grijanju ili hlađenju.
const updateRelayDescription = () => {
    const mode = document.getElementById("relay-mode").value;
    const description = mode === "cooling"
        ? "Hlađenje: relej se uključuje na ili iznad gornjeg praga, a isključuje na ili ispod donjeg praga."
        : "Grijanje: relej se uključuje na ili ispod donjeg praga, a isključuje na ili iznad gornjeg praga.";

    document.getElementById("relay-mode-help").textContent = description;
};

// Popunjava obrazac postavkama koje su spremljene za ESP32 uređaj.
const applyDeviceSettings = (settings) => {
    document.getElementById("light-enabled").checked = settings.light.enabled;
    document.getElementById("light-on-time").value = settings.light.onTime;
    document.getElementById("light-off-time").value = settings.light.offTime;
    document.getElementById("relay-mode").value = settings.relay.mode;
    document.getElementById("relay-on-temperature").value =
        settings.relay.turnOnTemperatureC;
    document.getElementById("relay-off-temperature").value =
        settings.relay.turnOffTemperatureC;
    updateRelayDescription();
};

// Prikazuje zadnja očitanja senzora i vrijeme kad ih je server primio.
const renderReadings = (readings) => {
    if (readings.name) {
        deviceStatus.textContent =
            `${readings.name} · ${readings.isActive ? "Aktivan" : "Deaktiviran"}`;
    }

    document.getElementById("temperature-value").textContent =
        Number.isFinite(readings.temperatureC) ? readings.temperatureC.toFixed(1) : "—";
    document.getElementById("humidity-value").textContent =
        Number.isFinite(readings.humidityPercent) ? readings.humidityPercent.toFixed(1) : "—";
    for (let sensorIndex = 1; sensorIndex <= 4; sensorIndex += 1) {
        const value = readings[`soilMoisture${sensorIndex}Percent`];
        document.getElementById(`soil-moisture-${sensorIndex}-value`).textContent =
            Number.isFinite(value) ? value.toFixed(1) : "—";
    }
    document.getElementById("device-last-seen").textContent = readings.lastSeenAt
        ? `Zadnje očitanje: ${new Date(readings.lastSeenAt).toLocaleString("hr-HR")}`
        : "ESP32 još nije poslao očitanje.";
};

// Učitava povijest uređaja vezanog uz trenutačno prijavljeni račun.
const loadMyTelemetryHistory = async () => {
    if (
        !hasAssignedDevice ||
        !isDeviceActive ||
        (historyPage && !historyPage.classList.contains("active"))
    ) return;

    const requestId = ++historyRequestId;

    if (!window.telemetryCharts) {
        telemetryHistoryMessage.textContent =
            "Grafove nije moguće prikazati jer se biblioteka nije učitala.";
        return;
    }

    try {
        const response = await fetch("/api/devices/mine/history");

        if (response.status === 401) {
            window.location.replace("/login");
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Povijest očitanja nije moguće učitati.");
        }
        if (requestId !== historyRequestId || !hasAssignedDevice || !isDeviceActive) return;

        if (userTelemetryChart) userTelemetryChart.destroy();
        userTelemetryChart = window.telemetryCharts.create(
            result.data,
            [
                document.getElementById("user-temperature-chart"),
                document.getElementById("user-humidity-chart"),
                ...Array.from({ length: 4 }, (_, index) =>
                    document.getElementById(`user-soil-moisture-${index + 1}-chart`)
                )
            ]
        );
        telemetryHistoryMessage.textContent = result.data.samples.length
            ? `Prikazano ${result.data.samples.length.toLocaleString("hr-HR")} uzoraka; grafikoni se osvježavaju svakih sat vremena. Sati bez očitanja su 0.`
            : "Još nema očitanja; grafovi za cijelo razdoblje prikazuju 0.";

        if (historyRefreshTimer) clearInterval(historyRefreshTimer);
        historyRefreshTimer = window.setInterval(
            refreshMyTelemetryHistory,
            window.telemetryCharts.intervalMs
        );
    } catch (error) {
        if (requestId !== historyRequestId) return;

        telemetryHistoryMessage.textContent =
            error.message || "Povijest očitanja nije moguće učitati.";
        console.error("Greška pri učitavanju vlastite povijesti ESP32 očitanja:", error);
    }
};

if (historyTab) {
    historyTab.addEventListener("shown.bs.tab", () => {
        if (!userTelemetryChart) void loadMyTelemetryHistory();
    });
}

// Osvježava samo novi sat i popunjava sate bez očitanja nulom.
const refreshMyTelemetryHistory = async () => {
    if (!hasAssignedDevice || !isDeviceActive || !userTelemetryChart) return;

    const requestId = historyRequestId;

    try {
        const after = new Date(userTelemetryChart.getEndAt()).toISOString();
        const response = await fetch(
            `/api/devices/mine/history?after=${encodeURIComponent(after)}`
        );

        if (response.status === 401) {
            window.location.replace("/login");
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Povijest očitanja nije moguće osvježiti.");
        }
        if (requestId !== historyRequestId || !hasAssignedDevice || !isDeviceActive) return;

        userTelemetryChart.apply(result.data);
        if (result.data.samples.length) {
            telemetryHistoryMessage.textContent =
                "Grafikoni se osvježavaju svakih sat vremena. Sati bez očitanja su 0.";
        }
    } catch (error) {
        if (requestId !== historyRequestId) return;

        telemetryHistoryMessage.textContent =
            "Grafovi su prikazani, ali trenutno nije moguće osvježiti nova očitanja.";
        console.error("Greška pri osvježavanju vlastite povijesti ESP32 očitanja:", error);
    }
};

// Zaustavlja osvježavanje i uklanja graf kad uređaj nije aktivan.
const clearMyTelemetryHistory = () => {
    historyRequestId += 1;
    if (historyRefreshTimer) clearInterval(historyRefreshTimer);
    historyRefreshTimer = null;
    if (userTelemetryChart) userTelemetryChart.destroy();
    userTelemetryChart = null;
    telemetryHistoryCard.classList.add("d-none");
};

// Skriva senzorska očitanja i povijest dok uređaj nije aktivan.
const setDeviceActive = (isActive) => {
    isDeviceActive = isActive;
    deviceReadingsSection.classList.toggle("d-none", !isActive);
    telemetryHistoryCard.classList.toggle("d-none", !isActive);
    deviceSettingsCard.classList.toggle("d-none", !isActive);
    if (historyUnavailableMessage) {
        historyUnavailableMessage.classList.toggle("d-none", isActive);
    }
    if (settingsUnavailableMessage) {
        settingsUnavailableMessage.classList.toggle("d-none", isActive);
    }
    if (adminOwnDeviceSection) {
        adminOwnDeviceSection.classList.toggle("d-none", !isActive);
        adminOwnDeviceLink.classList.toggle("d-none", !isActive);
    }
    settingsFields.disabled = !isActive;

    if (!isActive) {
        const message = hasAssignedDevice
            ? "Ovaj odjeljak nije dostupan dok je uređaj deaktiviran."
            : "Za ovaj račun nije dodijeljen ESP32 uređaj.";
        if (historyUnavailableMessage) historyUnavailableMessage.textContent = message;
        if (settingsUnavailableMessage) settingsUnavailableMessage.textContent = message;
    }

    if (!isActive) clearMyTelemetryHistory();
};

// Učitava identitet, pridruženi ESP32, zadnja očitanja i spremljene postavke.
(async () => {
    try {
        const user = await window.sessionUi.getCurrentUser();
        if (!user) return;

        const userName = document.getElementById("user-name");
        if (userName) {
            userName.textContent = user.name;
            document.getElementById("user-identity").textContent =
                `${user.email} · ${window.sessionUi.roleName(user.role)}`;
            document.getElementById("user-email").textContent = user.email;
            document.getElementById("user-role").textContent = window.sessionUi.roleName(user.role);
            document.getElementById("user-status").textContent =
                user.isActive ? "Aktivan" : "Neaktivan";
            document.getElementById("random-message").textContent =
                userDailyMessage;
        }

        const response = await fetch("/api/devices/mine");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Podatke uređaja nije moguće učitati.");
        }

        if (!result.data) {
            setDeviceActive(false);
            deviceStatus.textContent = "Još nema ESP32 uređaja dodijeljenog ovom računu.";
            return;
        }

        const device = result.data;
        hasAssignedDevice = true;
        deviceStatus.textContent =
            `${device.name} · ${device.isActive ? "Aktivan" : "Deaktiviran"}`;
        document.getElementById("device-mac-address").textContent =
            `MAC adresa: ${device.macAddress}`;
        applyDeviceSettings(device.controlSettings);
        setDeviceActive(device.isActive === true);

        if (isDeviceActive) {
            renderReadings({
                temperatureC: device.latestTemperatureC,
                humidityPercent: device.latestHumidityPercent,
                soilMoisture1Percent: device.latestSoilMoisture1Percent,
                soilMoisture2Percent: device.latestSoilMoisture2Percent,
                soilMoisture3Percent: device.latestSoilMoisture3Percent,
                soilMoisture4Percent: device.latestSoilMoisture4Percent,
                lastSeenAt: device.lastSeenAt
            });
            void loadMyTelemetryHistory();
        } else {
            deviceStatus.textContent =
                `${device.name} · Deaktiviran · očitanja su skrivena`;
        }

        // Provjerava status i očitanja bez prepisivanja nepohranjenih izmjena.
        window.setInterval(refreshReadings, 10_000);
    } catch (error) {
        dashboardMessage.textContent =
            error.message || "Nadzornu ploču nije moguće učitati.";
        dashboardMessage.className = "alert alert-danger";
        console.error("Greška pri učitavanju nadzorne ploče uređaja:", error);
    }
})();

// Učitava temperaturu, vlagu zraka i četiri sonde vlage tla; poziva se periodično.
async function refreshReadings() {
    if (!hasAssignedDevice || document.hidden) return;

    try {
        const response = await fetch("/api/devices/mine/readings", {
            cache: "no-store"
        });

        if (response.status === 401) {
            window.location.replace("/login");
            return;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Očitanja nije moguće osvježiti.");
        }

        if (result.data) {
            if (result.data.isActive !== true) {
                deviceStatus.textContent =
                    `${result.data.name || "ESP32"} · Deaktiviran · očitanja su skrivena`;
                if (isDeviceActive) setDeviceActive(false);
                return;
            }

            if (!isDeviceActive) {
                setDeviceActive(true);
                void loadMyTelemetryHistory();
            }
            renderReadings(result.data);
        } else {
            hasAssignedDevice = false;
            setDeviceActive(false);
            deviceStatus.textContent = "ESP32 uređaj više nije dodijeljen ovom računu.";
            document.getElementById("temperature-value").textContent = "—";
            document.getElementById("humidity-value").textContent = "—";
            for (let sensorIndex = 1; sensorIndex <= 4; sensorIndex += 1) {
                document.getElementById(`soil-moisture-${sensorIndex}-value`).textContent = "—";
            }
            document.getElementById("device-last-seen").textContent = "Nema očitanja.";
        }
    } catch (error) {
        document.getElementById("device-last-seen").textContent =
            "Trenutačno nije moguće osvježiti očitanja.";
        console.error("Greška pri osvježavanju ESP32 očitanja:", error);
    }
}

// Ažurira objašnjenje kad korisnik promijeni način rada releja.
document.getElementById("relay-mode").addEventListener("change", updateRelayDescription);
updateRelayDescription();

// Sprema cijeli skup postavki nakon provjere temperaturne histereze.
settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!hasAssignedDevice) return;

    const mode = document.getElementById("relay-mode").value;
    const turnOnTemperatureC = document.getElementById("relay-on-temperature").valueAsNumber;
    const turnOffTemperatureC = document.getElementById("relay-off-temperature").valueAsNumber;
    const validThresholdOrder = mode === "cooling"
        ? turnOnTemperatureC > turnOffTemperatureC
        : turnOnTemperatureC < turnOffTemperatureC;

    if (!validThresholdOrder) {
        showSettingsMessage(
            mode === "cooling"
                ? "Kod hlađenja temperatura uključivanja mora biti viša od temperature isključivanja."
                : "Kod grijanja temperatura uključivanja mora biti niža od temperature isključivanja.",
            "danger"
        );
        return;
    }

    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = "Spremanje...";
    settingsMessage.className = "alert d-none";

    try {
        const response = await fetch("/api/devices/mine/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                light: {
                    enabled: document.getElementById("light-enabled").checked,
                    onTime: document.getElementById("light-on-time").value,
                    offTime: document.getElementById("light-off-time").value
                },
                relay: {
                    mode,
                    turnOnTemperatureC,
                    turnOffTemperatureC
                }
            })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Postavke nije moguće spremiti.");
        }

        applyDeviceSettings(result.data.settings);
        showSettingsMessage(
            `${result.message} (verzija ${result.data.revision})`,
            "success"
        );
    } catch (error) {
        showSettingsMessage(error.message || "Postavke nije moguće spremiti.", "danger");
        console.error("Greška pri spremanju ESP32 postavki:", error);
    } finally {
        saveSettingsButton.disabled = false;
        saveSettingsButton.textContent = "Spremi postavke";
    }
});
