// Učitava administratorske podatke i slučajnu dobrodošlicu.
const adminMessages = [
    "Dobar sustav počinje pregledom dobrih podataka.",
    "Svaki korak naprijed počinje jasnim pregledom.",
    "Danas je dobar dan za uredno upravljanje sustavom.",
    "Male provjere čine veliku razliku u radu aplikacije."
];

const adminMessageElement = document.getElementById("dashboard-message");

// Popunjava administratorski dashboard podacima iz aktivne sesije.
(async () => {
    try {
        const admin = await window.sessionUi.getCurrentUser();
        if (!admin) return;

        document.getElementById("admin-name").textContent = admin.name;
        document.getElementById("admin-identity").textContent =
            `${admin.name} · ${window.sessionUi.roleName(admin.role)}`;
        document.getElementById("random-message").textContent =
            adminMessages[Math.floor(Math.random() * adminMessages.length)];

        const response = await fetch("/api/users");
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Broj korisnika nije moguće učitati.");
        }

        document.getElementById("user-count").textContent = String(result.count);
    } catch (error) {
        adminMessageElement.textContent = error.message || "Nadzornu ploču nije moguće učitati.";
        adminMessageElement.className = "alert alert-danger";
        console.error("Greška pri učitavanju administratorske nadzorne ploče:", error);
    }
})();
