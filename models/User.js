
// Mongoose omogućuje definiranje sheme i komunikaciju s MongoDB-om.
const mongoose = require("mongoose");

// Shema određuje strukturu, tipove i pravila korisničkih dokumenta.
const userSchema = new mongoose.Schema(
    {
        // Ime mora biti tekst između 2 i 100 znakova bez razmaka na rubovima.
        name: {
            type: String,
            required: [true, "Ime je obavezno"],
            trim: true,
            minlength: 2,
            maxlength: 100
        },

        // Email mora biti jedinstven i sprema se malim slovima.
        email: {
            type: String,
            required: [true, "Email je obavezan"],
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 254
        },

        // Lozinka mora biti najmanje 8 znakova i neće se vraćati u upitima.
        password: {
            type: String,
            required: [true, "Lozinka je obavezna"],
            minlength: 8,
            select: false
        },

        // Uloga može biti samo "admin" ili "user".
        role: {
            type: String,
            enum: ["admin", "user"],
            default: "user"
        },

        // Aktivni korisnici se smatraju dozvoljenima za daljnju upotrebu aplikacije.
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        // Automatski dodaje createdAt i updatedAt polja.
        timestamps: true
    }
);

// Kreira model User koji izvršava operacije nad kolekcijom users.
const User = mongoose.model("User", userSchema);

// Izvoz modela omogućuje korištenje u controlleru i drugim datotekama.
module.exports = User;
