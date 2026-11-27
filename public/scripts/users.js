// Dohvaća elemente stranice i priprema Bootstrap dijalog za uređivanje.
const tableBody = document.getElementById("users-table-body");
const userCount = document.getElementById("user-count");
const pageMessage = document.getElementById("page-message");
const editForm = document.getElementById("edit-user-form");
const editMessage = document.getElementById("edit-message");
const saveButton = document.getElementById("save-user");
const editModalElement = document.getElementById("edit-user-modal");
const editModal = bootstrap.Modal.getOrCreateInstance(editModalElement);
const detailsModalElement = document.getElementById("user-details-modal");
const detailsModal = bootstrap.Modal.getOrCreateInstance(detailsModalElement);
const editDeviceSettingsButton = document.getElementById("edit-user-device-settings");
const deviceSettingsModalElement = document.getElementById("user-device-settings-modal");
const deviceSettingsModal = bootstrap.Modal.getOrCreateInstance(deviceSettingsModalElement);
const deviceSettingsForm = document.getElementById("user-device-settings-form");
const deviceSettingsMessage = document.getElementById("user-device-settings-message");
const saveDeviceSettingsButton = document.getElementById("save-user-device-settings");
let selectedUserDetails = null;
let userHistoryChart = null;
let historyRequestId = 0;
let historyRefreshTimer = null;

// Provjerava sesiju jače nego samo prikazivanje administratorske stranice.
const loadAdminIdentity = async () => {
    const user = await window.sessionUi.getCurrentUser();

    if (!user) return false;
    if (user.role !== "admin") {
        window.location.replace("/dashboard");
        return false;
    }

    document.getElementById("admin-identity").textContent =
        `${user.name} · ${window.sessionUi.roleName(user.role)}`;
    return true;
};

// Prikazuje poruku na stranici ili unutar dijaloga.
const showMessage = (element, message, type) => {
    element.textContent = message;
    element.className = `alert alert-${type}`;
};

// Dodaje red za stanje učitavanja ili prazan popis.
const showTableMessage = (message) => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.className = "text-center text-secondary py-4";
    cell.textContent = message;
    row.append(cell);
    tableBody.replaceChildren(row);
};

// Kreira tekstualnu ćeliju bez tumačenja podataka kao HTML-a.
const createCell = (text, className = "") => {
    const cell = document.createElement("td");
    cell.className = className;
    cell.textContent = text;
    return cell;
};

// Pretvara korisnički dokument u siguran red tablice.
const createUserRow = (user) => {
    const row = document.createElement("tr");
    const personCell = document.createElement("td");
    const name = document.createElement("div");
    const email = document.createElement("div");
    const status = document.createElement("span");
    const statusCell = document.createElement("td");
    const actions = document.createElement("td");
    const actionGroup = document.createElement("div");
    const detailsButton = document.createElement("button");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    name.className = "fw-semibold";
    name.textContent = user.name || "Bez imena";
    email.className = "user-email small";
    email.textContent = user.email || "Bez email adrese";
    personCell.append(name, email);

    status.className = `badge ${user.isActive ? "text-bg-success" : "text-bg-secondary"}`;
    status.textContent = user.isActive ? "Aktivan" : "Neaktivan";
    statusCell.append(status);

    detailsButton.type = "button";
    detailsButton.className = "btn btn-sm btn-outline-light";
    detailsButton.textContent = "Detalji";
    detailsButton.dataset.action = "details";
    detailsButton.dataset.userId = user._id;

    editButton.type = "button";
    editButton.className = "btn btn-sm btn-outline-info";
    editButton.textContent = "Uredi";
    editButton.dataset.action = "edit";
    editButton.dataset.userId = user._id;

    deleteButton.type = "button";
    deleteButton.className = "btn btn-sm btn-outline-danger";
    deleteButton.textContent = "Obriši";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.userId = user._id;

    actions.className = "text-end";
    actionGroup.className = "d-inline-flex flex-wrap justify-content-end gap-2";
    actionGroup.append(detailsButton, editButton, deleteButton);
    actions.append(actionGroup);

    row.append(
        personCell,
        createCell(user.role === "admin" ? "Administrator" : "Korisnik"),
        statusCell,
        createCell(user.createdAt ? new Date(user.createdAt).toLocaleDateString("hr-HR") : "—"),
        actions
    );

    return row;
};

// Dohvaća korisnike s API-ja i osvježava tablicu.
const loadUsers = async () => {
    showTableMessage("Učitavanje korisnika...");

    try {
        const response = await fetch("/api/users");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Nije moguće učitati korisnike.");
        }

        const users = Array.isArray(result.data) ? result.data : [];
        userCount.textContent = String(users.length);

        if (users.length === 0) {
            showTableMessage("Još nema kreiranih korisnika.");
            return;
        }

        tableBody.replaceChildren(...users.map(createUserRow));
    } catch (error) {
        showTableMessage("Korisnike nije moguće učitati.");
        showMessage(pageMessage, error.message || "Došlo je do pogreške pri učitavanju.", "danger");
        console.error("Greška pri učitavanju korisnika:", error);
    }
};

// Popunjava dijalog odabranim korisnikom.
const openEditDialog = (user) => {
    document.getElementById("edit-user-id").value = user._id;
    document.getElementById("edit-name").value = user.name || "";
    document.getElementById("edit-email").value = user.email || "";
    document.getElementById("edit-role").value = user.role || "user";
    document.getElementById("edit-active").checked = Boolean(user.isActive);
    document.getElementById("edit-password").value = "";
    editMessage.className = "alert d-none";
    editModal.show();
};

// Puni prikaz detalja samo tekstualnim vrijednostima iz administratorskog API-ja.
const openDetailsDialog = (user) => {
    historyRequestId += 1;
    if (historyRefreshTimer) clearInterval(historyRefreshTimer);
    historyRefreshTimer = null;
    if (userHistoryChart) userHistoryChart.destroy();
    userHistoryChart = null;

    const setDetail = (id, value) => {
        document.getElementById(id).textContent = value;
    };
    const formatDate = (value) => value
        ? new Date(value).toLocaleString("hr-HR")
        : "Nema podataka";
    const formatMeasurement = (value, unit) => (
        typeof value === "number" && Number.isFinite(value)
            ? `${value.toLocaleString("hr-HR")} ${unit}`
            : "Nema očitanja"
    );

    setDetail("details-name", user.name || "Bez imena");
    setDetail("details-email", user.email || "Bez email adrese");
    setDetail("details-role", user.role === "admin" ? "Administrator" : "Korisnik");
    setDetail("details-status", user.isActive ? "Aktivan" : "Neaktivan");
    setDetail("details-created", formatDate(user.createdAt));
    setDetail("details-updated", formatDate(user.updatedAt));

    const device = user.device;
    selectedUserDetails = user;
    editDeviceSettingsButton.hidden = !device?.isActive;
    const deviceSection = document.getElementById("details-device-section");
    const noDeviceMessage = document.getElementById("details-no-device");
    const controlSettingsSection = document.getElementById("details-control-settings");
    const historySection = document.getElementById("details-history-section");
    deviceSection.classList.toggle("d-none", !device);
    noDeviceMessage.classList.toggle("d-none", Boolean(device));
    controlSettingsSection.classList.toggle("d-none", !device?.isActive);
    historySection.classList.toggle("d-none", !device?.isActive);

    if (device) {
        const telemetryMessage = "Nije dostupno jer je uređaj deaktiviran";
        setDetail("details-device-name", device.name || "ESP32");
        setDetail("details-device-mac", device.macAddress || "Nije navedena");
        setDetail("details-device-status", device.isActive ? "Aktivan" : "Neaktivan");
        setDetail("details-device-last-seen", formatDate(device.lastSeenAt));
        setDetail(
            "details-device-temperature",
            device.isActive ? formatMeasurement(device.temperatureC, "°C") : telemetryMessage
        );
        setDetail(
            "details-device-humidity",
            device.isActive ? formatMeasurement(device.humidityPercent, "%") : telemetryMessage
        );
        for (let sensorIndex = 1; sensorIndex <= 4; sensorIndex += 1) {
            setDetail(
                `details-soil-moisture-${sensorIndex}`,
                device.isActive
                    ? formatMeasurement(device[`soilMoisture${sensorIndex}Percent`], "%")
                    : telemetryMessage
            );
        }
        if (device.isActive) {
            const settings = device.controlSettings || {};
            const light = settings.light || {};
            const relay = settings.relay || {};
            const relayMode = relay.mode === "heating" ? "Niža temperatura ispuha od upuha" : "Niža temperatura upuha od ispuha";
            const onThreshold = formatMeasurement(relay.turnOnTemperatureC, "°C");
            const offThreshold = formatMeasurement(relay.turnOffTemperatureC, "°C");
            const relayThresholds = relay.mode === "heating"
                    ? `Uključi na ≤ ${onThreshold}; isključi na ≥ ${offThreshold}`
                    : `Uključi na ≥ ${onThreshold}; isključi na ≤ ${offThreshold}`;

            setDetail(
                    "details-light-schedule",
                    light.enabled ? `${light.onTime || "—"} – ${light.offTime || "—"}` : "Isključeno"
            );
            setDetail("details-timezone", settings.timezone || "Nije postavljena");
            setDetail("details-relay-settings", `${relayMode}: ${relayThresholds}`);
            setDetail(
                    "details-settings-revision",
                    device.settingsRevision === undefined ? "Nije dostupna" : String(device.settingsRevision)
            );
        } else {
            setDetail("details-light-schedule", telemetryMessage);
            setDetail("details-timezone", telemetryMessage);
            setDetail("details-relay-settings", telemetryMessage);
            setDetail("details-settings-revision", telemetryMessage);
        }
        document.getElementById("details-history-message").textContent =
            "Učitavanje povijesti očitanja...";
    }

    detailsModal.show();
    if (device?.isActive) loadUserHistory(user);
};

// Učitava povijest samo za korisnika koji je otvoren u administratorskim detaljima.
const loadUserHistory = async (user) => {
    const requestId = ++historyRequestId;
    const historyMessage = document.getElementById("details-history-message");

    if (!window.telemetryCharts) {
        historyMessage.textContent = "Grafove nije moguće prikazati jer se biblioteka nije učitala.";
        return;
    }

    try {
        const response = await fetch(
            `/api/devices/users/${encodeURIComponent(user._id)}/readings`
        );
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Povijest očitanja nije moguće učitati.");
        }
        if (requestId !== historyRequestId) return;

        userHistoryChart = window.telemetryCharts.create(
            result.data,
            [
                document.getElementById("user-temperature-chart"),
                document.getElementById("user-humidity-chart"),
                document.getElementById("admin-soil-moisture-chart")
            ]
        );
        historyMessage.textContent = result.data.samples.length
            ? `Prikazano ${result.data.samples.length.toLocaleString("hr-HR")} uzoraka; grafikoni se osvježavaju svakih sat vremena. Sati bez očitanja su 0.`
            : "Još nema očitanja; grafovi za cijelo razdoblje prikazuju 0.";

        if (detailsModalElement.classList.contains("show")) {
            historyRefreshTimer = setInterval(
                () => refreshUserHistory(user, requestId),
                window.telemetryCharts.intervalMs
            );
        }
    } catch (error) {
        if (requestId !== historyRequestId) return;

        historyMessage.textContent = error.message || "Povijest očitanja nije moguće učitati.";
        console.error("Greška pri učitavanju povijesti ESP32 očitanja:", error);
    }
};

// Dopunjava grafikone samo novim satima, bez ponovnog slanja cijele povijesti.
const refreshUserHistory = async (user, requestId) => {
    if (
        requestId !== historyRequestId ||
        !userHistoryChart
    ) {
        return;
    }

    try {
        const after = new Date(userHistoryChart.getEndAt()).toISOString();
        const response = await fetch(
            `/api/devices/users/${encodeURIComponent(user._id)}/readings?after=${encodeURIComponent(after)}`
        );
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Povijest očitanja nije moguće osvježiti.");
        }
        if (requestId !== historyRequestId) return;

        userHistoryChart.apply(result.data);
        if (result.data.samples.length) {
            document.getElementById("details-history-message").textContent =
                "Grafikoni se osvježavaju svakih sat vremena. Sati bez očitanja su 0.";
        }
    } catch (error) {
        if (requestId !== historyRequestId) return;

        document.getElementById("details-history-message").textContent =
            "Grafovi su prikazani, ali trenutno nije moguće osvježiti nova očitanja.";
        console.error("Greška pri osvježavanju povijesti ESP32 očitanja:", error);
    }
};

// Zaustavlja periodično osvježavanje nakon zatvaranja detalja korisnika.
detailsModalElement.addEventListener("hidden.bs.modal", () => {
    if (historyRefreshTimer) clearInterval(historyRefreshTimer);
    historyRefreshTimer = null;
});

// Popunjava administratorski obrazac postavkama uređaja pripadajućeg korisnika.
const openDeviceSettingsDialog = (user) => {
    if (!user.device?.isActive) return;

    const settings = user.device?.controlSettings || {};
    const light = settings.light || {};
    const relay = settings.relay || {};

    document.getElementById("settings-user-id").value = user._id;
    document.getElementById("settings-user-name").textContent =
        `${user.name || "Korisnik"} · MAC: ${user.device.macAddress}`;
    document.getElementById("admin-light-enabled").checked = light.enabled ?? true;
    document.getElementById("admin-light-on-time").value = light.onTime || "08:00";
    document.getElementById("admin-light-off-time").value = light.offTime || "20:00";
    document.getElementById("admin-relay-mode").value = relay.mode || "cooling";
    document.getElementById("admin-relay-on-temperature").value =
        relay.turnOnTemperatureC ?? 28;
    document.getElementById("admin-relay-off-temperature").value =
        relay.turnOffTemperatureC ?? 25;
    deviceSettingsMessage.className = "alert d-none";
    updateAdminRelayDescription();
    deviceSettingsModal.show();
};

// Objašnjava administratoru redoslijed temperaturnih pragova za izabrani način rada.
const updateAdminRelayDescription = () => {
    const mode = document.getElementById("admin-relay-mode").value;
    document.getElementById("admin-relay-mode-help").textContent =
        mode === "cooling"
            ? "Kod hlađenja relej se uključuje iznad gornjeg praga, a isključuje ispod donjeg."
            : "Kod grijanja relej se uključuje ispod donjeg praga, a isključuje iznad gornjeg.";
};

// Dohvaća jedan korisnički zapis za uređivanje ili pregled detalja.
const fetchUserById = async (userId) => {
    const response = await fetch(`/api/users/${encodeURIComponent(userId)}`);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Korisnika nije moguće učitati.");
    }

    return result.data;
};

// Prebacuje se iz detalja korisnika u poseban obrazac za uređaj.
editDeviceSettingsButton.addEventListener("click", async () => {
    if (!selectedUserDetails?._id) return;

    try {
        const user = await fetchUserById(selectedUserDetails._id);
        if (!user.device?.isActive) {
            openDetailsDialog(user);
            return;
        }

        selectedUserDetails = user;
        detailsModalElement.addEventListener(
            "hidden.bs.modal",
            () => openDeviceSettingsDialog(user),
            { once: true }
        );
        detailsModal.hide();
    } catch (error) {
        showMessage(
            pageMessage,
            error.message || "Postavke uređaja nije moguće učitati.",
            "danger"
        );
        console.error("Greška pri provjeri statusa ESP32 uređaja:", error);
    }
});

document.getElementById("admin-relay-mode").addEventListener(
    "change",
    updateAdminRelayDescription
);

// Sprema nove postavke pod odabranog korisnika kroz administratorsku rutu.
deviceSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mode = document.getElementById("admin-relay-mode").value;
    const turnOnTemperatureC =
        document.getElementById("admin-relay-on-temperature").valueAsNumber;
    const turnOffTemperatureC =
        document.getElementById("admin-relay-off-temperature").valueAsNumber;
    const validThresholdOrder = mode === "cooling"
        ? turnOnTemperatureC > turnOffTemperatureC
        : turnOnTemperatureC < turnOffTemperatureC;

    if (!validThresholdOrder) {
        showMessage(
            deviceSettingsMessage,
            mode === "cooling"
                ? "Kod hlađenja temperatura uključivanja mora biti viša od temperature isključivanja."
                : "Kod grijanja temperatura uključivanja mora biti niža od temperature isključivanja.",
            "danger"
        );
        return;
    }

    saveDeviceSettingsButton.disabled = true;
    saveDeviceSettingsButton.textContent = "Spremanje...";

    try {
        const userId = document.getElementById("settings-user-id").value;
        const response = await fetch(
            `/api/devices/users/${encodeURIComponent(userId)}/settings`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    light: {
                        enabled: document.getElementById("admin-light-enabled").checked,
                        onTime: document.getElementById("admin-light-on-time").value,
                        offTime: document.getElementById("admin-light-off-time").value
                    },
                    relay: {
                        mode,
                        turnOnTemperatureC,
                        turnOffTemperatureC
                    }
                })
            }
        );
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Postavke nije moguće spremiti.");
        }

        selectedUserDetails.device.controlSettings = result.data.settings;
        selectedUserDetails.device.settingsRevision = result.data.revision;
        selectedUserDetails.device.settingsUpdatedAt = result.data.updatedAt;
        showMessage(
            deviceSettingsMessage,
            `${result.message}. ESP32 će ih preuzeti pri sljedećoj provjeri (verzija ${result.data.revision}).`,
            "success"
        );
    } catch (error) {
        showMessage(
            deviceSettingsMessage,
            error.message || "Postavke nije moguće spremiti.",
            "danger"
        );
        console.error("Greška pri spremanju administratorskih ESP32 postavki:", error);
    } finally {
        saveDeviceSettingsButton.disabled = false;
        saveDeviceSettingsButton.textContent = "Spremi postavke";
    }
});

// Obrada gumba za detalje, uređivanje i brisanje putem delegiranja događaja.
tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const userId = button.dataset.userId;

    if (button.dataset.action === "details" || button.dataset.action === "edit") {
        try {
            const user = await fetchUserById(userId);
            if (button.dataset.action === "details") {
                openDetailsDialog(user);
            } else {
                openEditDialog(user);
            }
        } catch (error) {
            showMessage(pageMessage, error.message || "Došlo je do pogreške.", "danger");
            console.error("Greška pri dohvaćanju korisnika:", error);
        }
    }

    if (button.dataset.action === "delete") {
        if (!window.confirm("Jeste li sigurni da želite obrisati ovog korisnika?")) return;

        button.disabled = true;

        try {
            const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
                method: "DELETE"
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Korisnika nije moguće obrisati.");
            }

            await loadUsers();
            showMessage(pageMessage, result.message || "Korisnik je obrisan.", "success");
        } catch (error) {
            showMessage(pageMessage, error.message || "Došlo je do pogreške pri brisanju.", "danger");
            console.error("Greška pri brisanju korisnika:", error);
            button.disabled = false;
        }
    }
});

// Sprema izmjene korisnika; prazna lozinka znači da ostaje nepromijenjena.
editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = "Spremanje...";

    const password = document.getElementById("edit-password").value;
    const updates = {
        name: document.getElementById("edit-name").value.trim(),
        email: document.getElementById("edit-email").value.trim(),
        role: document.getElementById("edit-role").value,
        isActive: document.getElementById("edit-active").checked
    };

    if (password) updates.password = password;

    try {
        const userId = document.getElementById("edit-user-id").value;
        const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(updates)
        });
        const result = await response.json();

        if (!response.ok) {
            showMessage(editMessage, result.message || "Promjene nije moguće spremiti.", "danger");
            return;
        }

        editModal.hide();
        await loadUsers();
        showMessage(
            pageMessage,
            result.message || "Podaci korisnika su ažurirani.",
            result.emailAccepted === false ? "warning" : "success"
        );
    } catch (error) {
        showMessage(editMessage, "Nije moguće povezati se sa serverom.", "danger");
        console.error("Greška pri ažuriranju korisnika:", error);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Spremi promjene";
    }
});

// Osvježava popis ručno ili pri prvom otvaranju stranice.
document.getElementById("refresh-users").addEventListener("click", loadUsers);

// Učitava administratore i korisnike tek nakon provjere aktivne sesije.
(async () => {
    try {
        if (await loadAdminIdentity()) await loadUsers();
    } catch (error) {
        showMessage(pageMessage, error.message || "Nije moguće provjeriti prijavu.", "danger");
        console.error("Greška pri provjeri administratorske sesije:", error);
    }
})();
