// Prikazuje ime i prezime administratora uz gumb za odjavu.
(async () => {
    const identity = document.getElementById("admin-identity");

    try {
        const admin = await window.sessionUi.getCurrentUser();
        if (!admin) return;

        if (admin.role !== "admin") {
            window.location.replace("/dashboard");
            return;
        }

        identity.textContent = `${admin.name} · ${window.sessionUi.roleName(admin.role)}`;
    } catch (error) {
        identity.textContent = "Račun nije moguće učitati";
        console.error("Greška pri učitavanju administratorskog računa:", error);
    }
})();
