// Dohvaća samo JSON podatke vezane uz uređaj čiji je serijski token unesen.
const rawDataForm = document.getElementById("device-raw-form");
const serialTokenInput = document.getElementById("device-serial-token");
const loadRawDataButton = document.getElementById("load-device-raw-data");
const rawDataStatus = document.getElementById("device-raw-status");
const rawDataOutput = document.getElementById("device-raw-output");

rawDataForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const serialNumber = serialTokenInput.value.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(serialNumber)) {
        rawDataStatus.textContent = "Serijski broj mora sadržavati točno 64 heksadekadska znaka.";
        rawDataOutput.textContent = "";
        return;
    }

    loadRawDataButton.disabled = true;
    loadRawDataButton.textContent = "Dohvaćam...";
    rawDataStatus.textContent = "";
    rawDataOutput.textContent = "";

    try {
        const response = await fetch("/api/devices/raw", {
            headers: { Authorization: `Bearer ${serialNumber}` },
            cache: "no-store",
            credentials: "omit"
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "JSON podatke nije moguće dohvatiti.");
        }

        rawDataOutput.textContent = JSON.stringify(result, null, 2);
        rawDataStatus.textContent = "JSON podaci su uspješno dohvaćeni.";
    } catch (error) {
        rawDataStatus.textContent = error.message || "JSON podatke nije moguće dohvatiti.";
        console.error("Greška pri dohvaćanju sirovih JSON podataka ESP32 uređaja:", error);
    } finally {
        serialTokenInput.value = "";
        loadRawDataButton.disabled = false;
        loadRawDataButton.textContent = "Dohvati JSON";
    }
});
