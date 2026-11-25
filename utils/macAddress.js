// Normalizira MAC adresu u oblik AA:BB:CC:DD:EE:FF ili vrati null ako nije valjana.
const normalizeMacAddress = (value) => {
    if (typeof value !== "string") return null;

    const compactMac = value.trim().replace(/[:-]/g, "").toUpperCase();
    if (!/^[0-9A-F]{12}$/.test(compactMac)) return null;

    const octets = compactMac.match(/.{2}/g);
    const firstOctet = Number.parseInt(octets[0], 16);

    // Odbacuje broadcast, nultu i multicast MAC adresu.
    if (/^0{12}$|^F{12}$/.test(compactMac) || (firstOctet & 1) !== 0) {
        return null;
    }

    return octets.join(":");
};

module.exports = normalizeMacAddress;
