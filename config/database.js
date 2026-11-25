
// Mongoose je biblioteka za povezivanje Node.js aplikacije i MongoDB baze.
const mongoose = require("mongoose");

// Asinkronno povezuje aplikaciju s bazom iz MONGODB_URI varijable.
const connectDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Poruka potvrđuje uspješnu konekciju i prikazuje ime baze.
        console.log("MongoDB connected successfully!");
        console.log(`Database: ${mongoose.connection.name}`);

    } catch (error) {
        // Ako konekcija ne uspije, prikazuje razlog i zaustavlja aplikaciju.
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
};

// Izvoz funkcije koju server poziva pri pokretanju.
module.exports = connectDatabase;
