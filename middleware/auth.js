// Učitava model za dohvat i provjeru trenutno prijavljenog korisnika.
const User = require("../models/User");

// Vraća JSON pogrešku API-ju ili preusmjerava browser na prijavu.
const rejectUnauthenticatedRequest = (req, res) => {
    if (req.originalUrl.startsWith("/api/")) {
        return res.status(401).json({
            success: false,
            message: "Za nastavak se morate prijaviti"
        });
    }

    return res.redirect("/login");
};

// Provjerava sesiju i dohvaća aktualne podatke korisnika iz baze.
const requireAuth = async (req, res, next) => {
    if (!req.session?.userId) {
        return rejectUnauthenticatedRequest(req, res);
    }

    try {
        const user = await User.findById(req.session.userId)
            .select("name email role isActive");

        if (!user || !user.isActive) {
            return req.session.destroy((error) => {
                if (error) return next(error);
                return rejectUnauthenticatedRequest(req, res);
            });
        }

        req.user = user;
        return next();
    } catch (error) {
        return next(error);
    }
};

// Ograničava administratorske stranice i API operacije na admin ulogu.
const requireAdmin = (req, res, next) => {
    if (req.user?.role === "admin") return next();

    if (req.originalUrl.startsWith("/api/")) {
        return res.status(403).json({
            success: false,
            message: "Nemate ovlasti za ovu radnju"
        });
    }

    return res.redirect("/dashboard");
};

// Sprječava admin korisnika da otvara sučelje namijenjeno običnom korisniku.
const requireRegularUser = (req, res, next) => {
    if (req.user?.role === "user") return next();
    return res.redirect("/dashboard");
};

module.exports = {
    requireAuth,
    requireAdmin,
    requireRegularUser
};
