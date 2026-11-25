// Dohvaća elemente statusne stranice za prikaz API odgovora.
const statusMessage = document.getElementById("status-message");
const refreshButton = document.getElementById("refresh-status");

// Prikazuje status u oznaci s bojom koja odgovara rezultatu provjere.
const setStatusBadge = (element, label, isHealthy) => {
    element.textContent = label;
    element.className = `badge ${isHealthy ? "text-bg-success" : "text-bg-danger"}`;
};

// Pretvara broj sekundi rada u čitljiv prikaz dana, sati, minuta i sekundi.
const formatUptime = (totalSeconds) => {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${days} d ${hours} h ${minutes} min ${seconds} s`;
};

// Učitava stanje servera i baze s administratorskog API endpointa.
const loadServerStatus = async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = "Provjera...";
    statusMessage.className = "alert d-none";

    try {
        const response = await fetch("/api/admin/status", {
            headers: { Accept: "application/json" },
            cache: "no-store"
        });
        const result = await response.json();

        if (result.data) {
            const { server, database, checkedAt } = result.data;
            setStatusBadge(
                document.getElementById("server-status"),
                server.status === "online" ? "Radi" : "Nedostupan",
                server.status === "online"
            );
            setStatusBadge(
                document.getElementById("database-status"),
                database.status === "connected" ? "Povezana" : database.status,
                database.status === "connected"
            );
            document.getElementById("server-uptime").textContent =
                formatUptime(server.uptimeSeconds);
            document.getElementById("node-version").textContent = server.nodeVersion;
            document.getElementById("checked-at").textContent =
                `Zadnja provjera: ${new Date(checkedAt).toLocaleString("hr-HR")}`;
        }

        if (!response.ok) {
            throw new Error(result.message || "Nije moguće dohvatiti status servera.");
        }
    } catch (error) {
        statusMessage.textContent = error.message || "Provjera statusa nije uspjela.";
        statusMessage.className = "alert alert-danger";
        console.error("Greška pri provjeri statusa servera:", error);
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "Osvježi status";
    }
};

// Provjerava administratorsku sesiju prije prikaza statusnih informacija.
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
        await loadServerStatus();
    } catch (error) {
        statusMessage.textContent = error.message || "Nije moguće provjeriti prijavu.";
        statusMessage.className = "alert alert-danger";
        console.error("Greška pri učitavanju statusne stranice:", error);
    }
})();

// Omogućuje ponovno učitavanje stanja bez osvježavanja cijele stranice.
refreshButton.addEventListener("click", loadServerStatus);
