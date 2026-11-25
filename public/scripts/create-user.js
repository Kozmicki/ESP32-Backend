// Dohvaća elemente obrasca i mjesta za prikaz povratnih poruka.
const form = document.getElementById("create-user-form");
const messageBox = document.getElementById("form-message");
const submitButton = document.getElementById("submit-button");

// Prikazuje korisniku poruku o uspjehu ili pogrešci.
const showMessage = (message, type) => {
    messageBox.textContent = message;
    messageBox.className = `alert alert-${type}`;
};

// Šalje podatke obrasca API-ju i prikazuje odgovor servera.
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = formData.get("name").trim();
    const email = formData.get("email").trim();
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");

    // Lozinka za potvrdu ne šalje se serveru; služi samo lokalnoj provjeri.
    if (password !== confirmPassword) {
        showMessage("Lozinke se ne podudaraju.", "danger");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Kreiranje računa...";
    messageBox.classList.add("d-none");

    try {
        const response = await fetch("/api/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();

        if (!response.ok) {
            showMessage(result.message || "Račun nije moguće kreirati.", "danger");
            return;
        }

        form.reset();
        showMessage(`${result.message}. Sada se možete prijaviti.`, "success");
    } catch (error) {
        // Prikazuje jasnu poruku kad server nije dostupan ili odgovor nije moguće pročitati.
        showMessage("Nije moguće povezati se sa serverom. Pokušajte ponovno.", "danger");
        console.error("Greška pri kreiranju korisnika:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Kreiraj račun";
    }
});
