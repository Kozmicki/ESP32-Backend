const nodemailer = require("nodemailer");

const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sendUserWelcomeEmail = async ({ name, email, password }) => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error("SMTP konfiguracija nije postavljena");
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE.toLowerCase() === "true"
        : port === 465;

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });

    const loginUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "") + "/login";
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePassword = escapeHtml(password);
    const safeLoginUrl = escapeHtml(loginUrl);

    await transporter.sendMail({
        from: process.env.SMTP_FROM || `"SmartGrowBox" <${user}>`,
        to: email,
        subject: "Vaš SmartGrowBox korisnički račun je aktiviran",
        text:
            `Pozdrav ${name},\n\n` +
            `Vaš korisnički račun je aktiviran.\n\n` +
            `Podaci za prijavu:\n` +
            `Email: ${email}\n` +
            `Lozinka: ${password}\n\n` +
            `Za prijavu otvorite: ${loginUrl}\n\n` +
            `Hvala vam što koristite uslugu SmartGrowBox.`,
        html: `
            <div style="font-family:Arial,sans-serif;color:#212529;line-height:1.6">
                <h2>Dobrodošli, ${safeName}!</h2>
                <p>Vaš korisnički račun je aktiviran.</p>
                <p><strong>Email:</strong> ${safeEmail}<br>
                <strong>Lozinka:</strong> ${safePassword}</p>
                <p><a href="${safeLoginUrl}" style="display:inline-block;padding:10px 16px;background:#0d6efd;color:#fff;text-decoration:none;border-radius:6px">Prijavi se</a></p>
                <p>Hvala vam što koristite uslugu SmartGrowBox.</p>
            </div>
        `
    });
};

module.exports = { sendUserWelcomeEmail };
