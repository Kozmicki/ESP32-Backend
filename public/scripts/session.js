// Dijeli provjeru sesije i odjavu među svim nadzornim pločama.
window.sessionUi = {
    async getCurrentUser() {
        const response = await fetch("/api/auth/me");

        if (response.status === 401) {
            window.location.replace("/login");
            return null;
        }

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Nije moguće učitati korisnički račun.");
        }

        return result.data;
    },

    async logout() {
        const response = await fetch("/api/auth/logout", {
            method: "POST"
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || "Odjava nije uspjela.");
        }

        window.location.replace("/login");
    },

    roleName(role) {
        return role === "admin" ? "Administrator" : "Korisnik";
    }
};

// Veže svaki gumb za odjavu i prikazuje pogrešku ako server ne potvrdi zahtjev.
document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            await window.sessionUi.logout();
        } catch (error) {
            const message = document.getElementById("dashboard-message");
            if (message) {
                message.textContent = error.message;
                message.className = "alert alert-danger";
            }
            button.disabled = false;
        }
    });
});
