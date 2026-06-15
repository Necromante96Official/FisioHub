const parseStoredStringArray = (raw) => {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .map((value) => typeof value === "string" ? value.trim() : "")
            .filter((value) => value.length > 0);
    }
    catch {
        return [];
    }
};
const toStoredStringArray = (values) => {
    const normalized = Array.from(values)
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
    return Array.from(new Set(normalized)).sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
};
export const readStoredStringSet = (storageKey) => {
    return new Set(parseStoredStringArray(localStorage.getItem(storageKey)));
};
export const writeStoredStringSet = (storageKey, values) => {
    localStorage.setItem(storageKey, JSON.stringify(toStoredStringArray(values)));
};
//# sourceMappingURL=stored-string-set.js.map