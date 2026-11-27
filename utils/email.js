const nodemailer = require("nodemailer");

const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const createTransporter = () => {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        throw new Error("SMTP konfiguracija nije postavljena");
    }

    if (!process.env.SMTP_FROM) {
        throw new Error("SMTP_FROM mora biti verificirana adresa pošiljatelja");
    }

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE.toLowerCase() === "true"
        : port === 465;

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass }
    });
};

const sendUserWelcomeEmail = async ({ name, email, password }) => {
    const transporter = createTransporter();

    const loginUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "") + "/login";
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safePassword = escapeHtml(password);
    const safeLoginUrl = escapeHtml(loginUrl);

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
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

const sendDeviceNotification = async ({ name, email, deviceName, macAddress, event }) => {
    const transporter = createTransporter();
    const eventDetails = {
        assigned: {
            subject: "ESP32 uređaj dodijeljen vašem računu",
            text: "ESP32 uređaj dodijeljen je vašem korisničkom računu."
        },
        activated: {
            subject: "Vaš ESP32 uređaj je aktiviran",
            text: "Vaš ESP32 uređaj je aktiviran."
        },
        deactivated: {
            subject: "Vaš ESP32 uređaj je deaktiviran",
            text: "Vaš ESP32 uređaj je deaktiviran."
        }
    }[event];

    if (!eventDetails) {
        throw new Error("Nepoznata vrsta obavijesti za uređaj");
    }

    const safeName = escapeHtml(name);
    const safeDeviceName = escapeHtml(deviceName);
    const safeMacAddress = escapeHtml(macAddress);

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: eventDetails.subject,
        text:
            `Pozdrav ${name},\n\n${eventDetails.text}\n\n` +
            `Naziv uređaja: ${deviceName}\n` +
            `MAC adresa: ${macAddress}\n\n` +
            "Hvala vam što koristite uslugu SmartGrowBox.",
        html: `
            <div style="font-family:Arial,sans-serif;color:#212529;line-height:1.6">
                <h2>Pozdrav, ${safeName}!</h2>
                <p>${eventDetails.text}</p>
                <p><strong>Naziv uređaja:</strong> ${safeDeviceName}<br>
                <strong>MAC adresa:</strong> ${safeMacAddress}</p>
                <p>Hvala vam što koristite uslugu SmartGrowBox.</p>
            </div>
        `
    });
};

const sendUserStatusNotification = async ({ name, email, isActive }) => {
    const transporter = createTransporter();
    const statusText = isActive
        ? "Vaš korisnički račun je aktiviran. Sada se možete prijaviti."
        : "Vaš korisnički račun je deaktiviran i više se ne možete prijaviti.";
    const safeName = escapeHtml(name);

    await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: isActive
            ? "Vaš SmartGrowBox korisnički račun je aktiviran"
            : "Vaš SmartGrowBox korisnički račun je deaktiviran",
        text: `Pozdrav ${name},\n\n${statusText}\n\nHvala vam što koristite uslugu SmartGrowBox.`,
        html: `
            <div style="font-family:Arial,sans-serif;color:#212529;line-height:1.6">
                <h2>Pozdrav, ${safeName}!</h2>
                <p>${statusText}</p>
                <p>Hvala vam što koristite uslugu SmartGrowBox.</p>
            </div>
        `
    });
};

module.exports = {
    sendUserWelcomeEmail,
    sendDeviceNotification,
    sendUserStatusNotification
};
