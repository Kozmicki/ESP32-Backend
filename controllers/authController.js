// Učitava model i alat za provjeru šifriranih lozinki.
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Oblikuje podatke koji se smiju vratiti pregledniku.
const toPublicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive
});

// Provjerava podatke za prijavu i pokreće novu sesiju.
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body || {};

        if (typeof email !== "string" || typeof password !== "string" || !password) {
            return res.status(400).json({
                success: false,
                message: "Unesite email adresu i lozinku"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail }).select("+password");
        const passwordMatches = user
            ? await bcrypt.compare(password, user.password)
            : false;

        if (!user || !user.isActive || !passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Email ili lozinka nisu ispravni"
            });
        }

        // Mijenja ID sesije nakon uspješne prijave kako bi spriječio session fixation.
        await new Promise((resolve, reject) => {
            req.session.regenerate((error) => {
                if (error) return reject(error);
                return resolve();
            });
        });

        req.session.userId = user._id.toString();

        // Čeka spremanje sesije prije nego što potvrdi uspješnu prijavu.
        await new Promise((resolve, reject) => {
            req.session.save((error) => {
                if (error) return reject(error);
                return resolve();
            });
        });

        return res.status(200).json({
            success: true,
            message: "Prijava je uspješna",
            data: toPublicUser(user)
        });
    } catch (error) {
        return next(error);
    }
};

// Vraća sigurne podatke korisnika koji je prijavljen u trenutačnoj sesiji.
const getCurrentUser = (req, res) => {
    return res.status(200).json({
        success: true,
        data: toPublicUser(req.user)
    });
};

// Uništava sesiju i uklanja autentifikacijski kolačić.
const logout = (req, res, next) => {
    req.session.destroy((error) => {
        if (error) return next(error);

        res.clearCookie("esp32.sid", {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            path: "/"
        });

        return res.status(200).json({
            success: true,
            message: "Odjavljeni ste"
        });
    });
};

module.exports = {
    login,
    getCurrentUser,
    logout
};
