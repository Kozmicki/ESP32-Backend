
// Centralni handler pretvara pogreške u jedinstven JSON odgovor.
const errorHandler = (err, req, res, next) => {
    // Ispisuje puni detalj pogreške u konzolu na strani servera.
    console.error(err);

    // ValidationError nastaje kad podaci ne zadovoljavaju Mongoose pravila.
    if (err.name === "ValidationError") {
        return res.status(400).json({
            success: false,
            message: "Greška u validaciji podataka",
            // Lista poruka za svako neispravno polje.
            errors: Object.values(err.errors).map(
                error => error.message
            )
        });
    }

    // CastError nastaje kod neispravnog ID-a ili neprepoznatog tipa podatka.
    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: "Neispravan ID ili format podatka"
        });
    }

    // Ostale greške vraćaju status greške ili standardnih 500.
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.statusCode
            ? err.message
            : "Interna greška servera"
    });
};

module.exports = errorHandler;
