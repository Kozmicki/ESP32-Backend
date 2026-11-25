// Valja i normalizira 256-bitni serijski token koji se ugradi u jedan ESP32.
const normalizeDeviceSerial = (value) => {
    if (typeof value !== "string") return null;

    const serialNumber = value.trim();
    if (!/^[a-fA-F0-9]{64}$/.test(serialNumber)) return null;

    return serialNumber.toLowerCase();
};

module.exports = normalizeDeviceSerial;
