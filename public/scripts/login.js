// Dohvaća elemente obrasca za prijavu i poruku o rezultatu.
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const loginButton = document.getElementById("login-button");

// Šalje vjerodajnice API-ju i otvara sučelje prema korisničkoj ulozi.
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginButton.disabled = true;
    loginButton.textContent = "Prijava...";
    loginMessage.className = "alert d-none";

    const formData = new FormData(loginForm);

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: formData.get("email"),
                password: formData.get("password")
            })
        });
        const result = await response.json();

        if (!response.ok) {
            loginMessage.textContent = result.message || "Prijava nije uspjela.";
            loginMessage.className = "alert alert-danger";
            return;
        }

        window.location.assign(result.data.role === "admin"
            ? "/admin/dashboard"
            : "/user/dashboard");
    } catch (error) {
        loginMessage.textContent = "Nije moguće povezati se sa serverom. Pokušajte ponovno.";
        loginMessage.className = "alert alert-danger";
        console.error("Greška pri prijavi:", error);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Prijavi se";
    }
});
