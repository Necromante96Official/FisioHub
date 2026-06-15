export const buildWhatsappLink = (phone: string): string | null => {
    const onlyDigits = phone.replace(/\D/g, "");
    if (!onlyDigits) {
        return null;
    }

    const withCountryCode = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;
    return `https://wa.me/${withCountryCode}`;
};

