export const normalizeText = (value) => {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
};
export const stripUnsafeTrailing = (value) => {
    return value.replace(/[^A-Za-zÀ-ÿ\s.'-]+$/g, "").trim();
};
export const toDateKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
};
