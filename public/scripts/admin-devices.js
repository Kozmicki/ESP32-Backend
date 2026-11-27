// Dohvaća elemente za korisnike, ESP32 uređaje i unos serijskog tokena.
const deviceForm = document.getElementById("create-device-form");
const deviceUserSelect = document.getElementById("device-user");
const deviceMacInput = document.getElementById("device-mac");
const deviceSerialInput = document.getElementById("device-serial");
const deviceNameInput = document.getElementById("device-name");
const deviceTableBody = document.getElementById("devices-table-body");
const deviceCount = document.getElementById("device-count");
const devicesMessage = document.getElementById("devices-message");
const registrationPanel = document.getElementById("device-registration-panel");
const createDeviceButton = document.getElementById("create-device-button");
const tokenUpdateDialog = document.getElementById("update-device-token-dialog");
const tokenUpdateForm = document.getElementById("update-device-token-form");
const tokenUpdateMessage = document.getElementById("update-token-message");
const saveTokenUpdateButton = document.getElementById("save-token-update");

// Prikazuje statusne poruke bez ubacivanja API teksta kao HTML-a.
const showDevicesMessage = (message, type) => {
    devicesMessage.textContent = message;
    devicesMessage.className = `alert alert-${type}`;
};

// Pretvara API odgovor u JSON i pretvara HTTP greške u jasne poruke.
const requestJson = async (url, options) => {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Zahtjev nije uspio.");
    }

    return result;
};

// Dodaje jednu običnu tekstualnu ćeliju u tablicu.
const createCell = (text, className = "") => {
    const cell = document.createElement("td");
    cell.className = className;
    cell.textContent = text;
    return cell;
};

// Prikaže stanje učitavanja, prazan popis ili poruku o pogrešci.
const showTableMessage = (message) => {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "text-center text-secondary py-4";
    cell.textContent = message;
    row.append(cell);
    deviceTableBody.replaceChildren(row);
};

// Potvrđuje registraciju bez prikazivanja ili vraćanja serijskog tokena.
const showDeviceRegistration = (device) => {
    document.getElementById("registered-device-mac").textContent = device.macAddress;
    registrationPanel.classList.remove("d-none");
    registrationPanel.scrollIntoView({ behavior: "smooth", block: "center" });
};

// Kreira red s vlasnikom, statusom i sigurnim administratorskim radnjama.
const createDeviceRow = (device) => {
    const row = document.createElement("tr");
    const owner = device.user;
    const ownerCell = document.createElement("td");
    const ownerName = document.createElement("div");
    const ownerEmail = document.createElement("div");
    const deviceCell = document.createElement("td");
    const deviceName = document.createElement("div");
    const macAddress = document.createElement("code");
    const status = document.createElement("span");
    const statusCell = document.createElement("td");
    const actions = document.createElement("td");
    const actionGroup = document.createElement("div");

    ownerName.className = "fw-semibold";
    ownerName.textContent = owner?.name || "Nepoznat korisnik";
    ownerEmail.className = "small text-secondary";
    ownerEmail.textContent = owner?.email || "";
    ownerCell.append(ownerName, ownerEmail);

    deviceName.textContent = device.name || "ESP32";
    macAddress.className = "device-mac";
    macAddress.textContent = device.macAddress || "MAC nije evidentiran";
    deviceCell.append(deviceName, macAddress);

    status.className = `badge ${device.isActive ? "text-bg-success" : "text-bg-secondary"}`;
    status.textContent = device.isActive ? "Aktivan" : "Deaktiviran";
    statusCell.append(status);

    const lastSeen = device.lastSeenAt
        ? new Date(device.lastSeenAt).toLocaleString("hr-HR")
        : "Još se nije javio";

    const updateTokenButton = document.createElement("button");
    updateTokenButton.type = "button";
    updateTokenButton.className = "btn btn-sm btn-outline-info";
    updateTokenButton.textContent = "Ažuriraj token";
    updateTokenButton.dataset.action = "update-token";
    updateTokenButton.dataset.deviceRecordId = device.id;

    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = "btn btn-sm btn-outline-light";
    statusButton.textContent = device.isActive ? "Deaktiviraj" : "Aktiviraj";
    statusButton.dataset.action = "toggle";
    statusButton.dataset.deviceRecordId = device.id;
    statusButton.dataset.active = String(device.isActive);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-sm btn-outline-danger";
    deleteButton.textContent = "Ukloni";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.deviceRecordId = device.id;

    actionGroup.className = "d-flex justify-content-end flex-wrap gap-2";
    actionGroup.append(updateTokenButton, statusButton, deleteButton);
    actions.append(actionGroup);

    row.append(
        ownerCell,
        deviceCell,
        statusCell,
        createCell(lastSeen),
        actions
    );

    return row;
};

// Učitava korisnike i uređaje te nudi samo aktivne korisnike bez uređaja.
const loadDevices = async () => {
    showTableMessage("Učitavanje uređaja...");

    try {
        const [usersResult, devicesResult] = await Promise.all([
            requestJson("/api/users"),
            requestJson("/api/devices")
        ]);
        const devices = devicesResult.data || [];
        const assignedUserIds = new Set(
            devices.map((device) => device.user?._id).filter(Boolean)
        );
        const availableUsers = (usersResult.data || []).filter(
            (user) => user.isActive && !assignedUserIds.has(user._id)
        );

        deviceUserSelect.replaceChildren();
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = availableUsers.length
            ? "Odaberite korisnika"
            : "Nema slobodnih korisnika";
        deviceUserSelect.append(placeholder);

        for (const user of availableUsers) {
            const option = document.createElement("option");
            option.value = user._id;
            option.textContent = `${user.name} (${user.email})`;
            deviceUserSelect.append(option);
        }

        createDeviceButton.disabled = availableUsers.length === 0;
        deviceCount.textContent = String(devices.length);
        deviceTableBody.replaceChildren(...devices.map(createDeviceRow));

        if (devices.length === 0) {
            showTableMessage("Još nema dodijeljenih ESP32 uređaja.");
        }
    } catch (error) {
        showTableMessage("Uređaje nije moguće učitati.");
        showDevicesMessage(error.message, "danger");
        console.error("Greška pri učitavanju ESP32 uređaja:", error);
    }
};

// Provjerava administratorsku sesiju prije prikaza upravljačkih podataka.
(async () => {
    try {
        const admin = await window.sessionUi.getCurrentUser();
        if (!admin) return;

        if (admin.role !== "admin") {
            window.location.replace("/dashboard");
            return;
        }

        document.getElementById("admin-identity").textContent =
            `${admin.name} · ${window.sessionUi.roleName(admin.role)}`;
        await loadDevices();
    } catch (error) {
        showDevicesMessage(error.message || "Nije moguće provjeriti prijavu.", "danger");
        console.error("Greška pri provjeri administratorske sesije:", error);
    }
})();

// Povezuje uređaj s korisnikom pomoću firmwareom generiranog serijskog tokena.
deviceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    createDeviceButton.disabled = true;
    createDeviceButton.textContent = "Dodjela...";

    try {
        const result = await requestJson("/api/devices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: deviceUserSelect.value,
                macAddress: deviceMacInput.value.trim(),
                serialNumber: deviceSerialInput.value.trim(),
                name: deviceNameInput.value.trim()
            })
        });

        showDeviceRegistration(result.data);
        showDevicesMessage(result.message, result.emailAccepted === false ? "warning" : "success");
        deviceForm.reset();
        await loadDevices();
    } catch (error) {
        showDevicesMessage(error.message, "danger");
    } finally {
        createDeviceButton.textContent = "Dodijeli";
        createDeviceButton.disabled = deviceUserSelect.options.length <= 1;
    }
});

// Otvara skriveni unos za serijski token koji je već ugrađen u novi firmware.
const openTokenUpdateDialog = (deviceRecordId, macAddress) => {
    document.getElementById("update-token-device-id").value = deviceRecordId;
    document.getElementById("update-token-device-mac").textContent = `MAC adresa: ${macAddress}`;
    document.getElementById("update-token-serial").value = "";
    tokenUpdateMessage.className = "alert d-none";
    tokenUpdateDialog.showModal();
};

// Spremi hash novog serijskog tokena; sam token ostaje samo u ESP32 firmwareu.
tokenUpdateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveTokenUpdateButton.disabled = true;
    saveTokenUpdateButton.textContent = "Ažuriranje...";

    try {
        const deviceRecordId = document.getElementById("update-token-device-id").value;
        const serialNumber = document.getElementById("update-token-serial").value.trim();
        const result = await requestJson(
            `/api/devices/${encodeURIComponent(deviceRecordId)}/token`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serialNumber })
            }
        );

        document.getElementById("update-token-serial").value = "";
        tokenUpdateDialog.close();
        showDevicesMessage(
            `${result.message}. Firmware mora koristiti novi serijski broj.`,
            "success"
        );
        await loadDevices();
    } catch (error) {
        tokenUpdateMessage.textContent = error.message || "Token nije moguće ažurirati.";
        tokenUpdateMessage.className = "alert alert-danger";
        console.error("Greška pri ažuriranju serijskog tokena:", error);
    } finally {
        saveTokenUpdateButton.disabled = false;
        saveTokenUpdateButton.textContent = "Ažuriraj";
    }
});

document.getElementById("cancel-token-update").addEventListener("click", () => {
    tokenUpdateDialog.close();
});

// Otvara token ažuriranje ili izvršava aktivaciju/deaktivaciju i uklanjanje uređaja.
deviceTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const { action, deviceRecordId } = button.dataset;
    let options;

    if (action === "update-token") {
        const row = button.closest("tr");
        const macAddress = row.querySelector(".device-mac").textContent;
        openTokenUpdateDialog(deviceRecordId, macAddress);
        return;
    } else if (action === "toggle") {
        const isActive = button.dataset.active !== "true";
        options = {
            method: "PATCH",
            url: `/api/devices/${encodeURIComponent(deviceRecordId)}/status`,
            body: { isActive }
        };
    } else {
        if (!window.confirm("Ukloniti uređaj? Token će prestati vrijediti.")) return;
        options = { method: "DELETE", url: `/api/devices/${encodeURIComponent(deviceRecordId)}` };
    }

    button.disabled = true;

    try {
        const result = await requestJson(options.url, {
            method: options.method,
            headers: options.body ? { "Content-Type": "application/json" } : undefined,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        showDevicesMessage(result.message, result.emailAccepted === false ? "warning" : "success");
        await loadDevices();
    } catch (error) {
        showDevicesMessage(error.message, "danger");
        console.error("Greška pri upravljanju ESP32 uređajem:", error);
        button.disabled = false;
    }
});

// Omogućuje ručno osvježavanje tablice uređaja i vlasnika.
document.getElementById("refresh-devices").addEventListener("click", loadDevices);
