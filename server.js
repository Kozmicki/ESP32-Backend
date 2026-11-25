
// Učitava konfiguraciju iz .env prije čitanja varijabli.
require("dotenv").config();

// Učitava module za sesije, HTTP server i posluživanje datoteka.
const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

// Učitava bazu, API rute, provjere ovlasti i zajedničku obradu pogrešaka.
const connectDatabase = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const adminRoutes = require("./routes/adminRoutes");
const errorHandler = require("./middleware/errorHandler");
const {
    requireAuth,
    requireAdmin,
    requireRegularUser
} = require("./middleware/auth");

// Kreira aplikaciju i definira lokaciju javnih datoteka.
const app = express();
const publicDirectory = path.join(__dirname, "public");
const sessionCookieName = "esp32.sid";

// Poslužuje HTML stranice bez pohrane osjetljivih prikaza u browser cache.
const sendPrivatePage = (...segments) => (req, res) => {
    res.set("Cache-Control", "no-store");
    return res.sendFile(path.join(publicDirectory, ...segments));
};

// Povjerenje u proxy potrebno je da HTTPS kolačić radi iza reverse proxyja.
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

// Omogućuje API pozive i parsiranje tijela HTTP zahtjeva.
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Provjerava postoji li dovoljno dug ključ za potpisivanje sesijskih kolačića.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error("Dodajte SESSION_SECRET duljine barem 32 znaka u .env datoteku.");
}

// Sprema sesije u MongoDB i ograničava pristup sesijskom kolačiću iz JavaScripta.
app.use(session({
    name: sessionCookieName,
    secret: process.env.SESSION_SECRET,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions",
        ttl: 8 * 60 * 60
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 8 * 60 * 60 * 1000
    }
}));

// Isporučuje samo CSS i browser JavaScript; HTML stranice imaju posebne rute.
app.use("/style", express.static(path.join(publicDirectory, "style")));
app.use("/scripts", express.static(path.join(publicDirectory, "scripts")));
app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

// Prijavljenog korisnika vodi na dashboard, a gostu prikazuje javnu početnu stranicu.
app.get("/", (req, res) => {
    if (req.session.userId) return res.redirect("/dashboard");
    return sendPrivatePage("index.html")(req, res);
});
app.get("/dashboard", requireAuth, (req, res) => {
    return res.redirect(req.user.role === "admin"
        ? "/admin/dashboard"
        : "/user/dashboard");
});

// Prikazuje prijavu samo gostima; aktivne sesije preusmjerava prema ulozi.
app.get("/login", async (req, res, next) => {
    if (!req.session.userId) {
        return sendPrivatePage("login.html")(req, res);
    }

    try {
        const User = require("./models/User");
        const user = await User.findById(req.session.userId).select("role isActive");

        if (user?.isActive) {
            return res.redirect(user.role === "admin"
                ? "/admin/dashboard"
                : "/user/dashboard");
        }

        return req.session.destroy((error) => {
            if (error) return next(error);
            return sendPrivatePage("login.html")(req, res);
        });
    } catch (error) {
        return next(error);
    }
});

// Registracija ostaje dostupna bez prijave, ali stvara samo obične korisnike.
app.get("/users/create", requireAuth, requireAdmin, (req, res) => {
    res.sendFile(path.join(publicDirectory, "users", "create.html"));
});
app.get("/users/create.html", requireAuth, requireAdmin, (req, res) => {
    return res.redirect("/users/create");
});

// Zaštićene HTML stranice razdvajaju administratorsko i korisničko sučelje.
app.get("/admin/dashboard", requireAuth, requireAdmin, (req, res) => {
    return sendPrivatePage("admin", "dashboard.html")(req, res);
});
app.get("/admin/users", requireAuth, requireAdmin, (req, res) => {
    return sendPrivatePage("users", "index.html")(req, res);
});
app.get("/admin/devices", requireAuth, requireAdmin, (req, res) => {
    return sendPrivatePage("admin", "devices.html")(req, res);
});
app.get("/admin/status", requireAuth, requireAdmin, (req, res) => {
    return sendPrivatePage("admin", "status.html")(req, res);
});
app.get("/admin/tools", requireAuth, requireAdmin, (req, res) => {
    return sendPrivatePage("admin", "tools.html")(req, res);
});
app.get("/admin/tools/device-raw", requireAuth, requireAdmin, (req, res) => {
    return sendPrivatePage("device-raw.html")(req, res);
});
app.get("/user/dashboard", requireAuth, requireRegularUser, (req, res) => {
    return sendPrivatePage("user", "dashboard.html")(req, res);
});
app.get("/device-raw", requireAuth, requireAdmin, (req, res) => {
    return res.redirect("/admin/tools/device-raw");
});

// Vraća status servera za nadzor i dijagnostiku.
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "ESP32 Backend API is running"
    });
});

// Registrira prijavu i korisničke rute s vlastitim provjerama ovlasti.
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/devices", deviceRoutes);

// Centralni error handler mora slijediti sve rute.
app.use(errorHandler);

// Koristi PORT iz .env datoteke ili zadanu vrijednost 3000.
const PORT = process.env.PORT || 3000;

// Povezuje bazu prije nego što počne prihvaćati HTTP zahtjeve.
const startServer = async () => {
    await connectDatabase();

    app.listen(PORT, "0.0.0.0", () => {
        console.log("--------------------------------");
        console.log("ESP32 BACKEND SERVER");
        console.log(`Port: ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
        console.log(`URL: http://localhost:${PORT}`);
        console.log("--------------------------------");
    });
};

startServer().catch((error) => {
    console.error("Server nije moguće pokrenuti:", error.message);
    process.exitCode = 1;
});
