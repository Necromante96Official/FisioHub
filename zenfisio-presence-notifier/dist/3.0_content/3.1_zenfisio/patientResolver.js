import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../../1.0_shared/patientName.js";
const FIELD_SELECTORS = [
    "[data-field='paciente']",
    "[data-field='patient']",
    "[class*='paciente']",
    "[class*='patient']",
    "[id*='paciente']",
    "[id*='patient']",
    "a[href*='paciente']",
    "a[href*='patient']"
];
const CONTAINER_SELECTORS = [
    ".popover",
    "[role='dialog']",
    ".modal",
    "[role='menu']",
    "[role='option']",
    "tr",
    "li",
    "article",
    "section",
    ".agendamento",
    ".appointment",
    ".calendar-event"
];
const toCandidate = (value) => {
    const fromLabel = extractPatientNameFromText(value);
    if (fromLabel && isLikelyValidPatientName(fromLabel)) {
        return fromLabel;
    }
    const sanitized = sanitizePatientName(value);
    if (isLikelyValidPatientName(sanitized)) {
        return sanitized;
    }
    return null;
};
const readFromLabelledNode = (scope, keyword) => {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT, {
        acceptNode: node => {
            const text = node.textContent || "";
            return text.toLowerCase().includes(keyword) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
    });
    while (walker.nextNode()) {
        const currentNode = walker.currentNode;
        const text = (currentNode.textContent || (currentNode instanceof HTMLElement ? currentNode.innerText : "") || "").trim();
        if (!text) {
            continue;
        }
        const candidate = toCandidate(text);
        if (candidate) {
            return candidate;
        }
    }
    return null;
};
const readFromElements = (scope) => {
    for (const selector of FIELD_SELECTORS) {
        const elements = Array.from(scope.querySelectorAll(selector));
        for (const element of elements) {
            const text = (element.textContent || "").trim();
            if (!text) {
                continue;
            }
            const candidate = toCandidate(text);
            if (candidate) {
                return candidate;
            }
        }
    }
    return null;
};
const readFromScopeByKeywords = (scope) => {
    const keywords = ["paciente", "patient", "nome"];
    for (const keyword of keywords) {
        const found = readFromLabelledNode(scope, keyword);
        if (found) {
            return found;
        }
    }
    return null;
};
const readFromScopeText = (scope) => {
    const text = (scope.innerText || scope.textContent || "").slice(0, 2500);
    if (!text) {
        return null;
    }
    return toCandidate(text);
};
const readFromDocumentFallback = () => {
    const root = document.body || document.documentElement;
    if (!root) {
        return null;
    }
    const fromElements = readFromElements(root);
    if (fromElements) {
        return fromElements;
    }
    const fromLabelled = readFromScopeByKeywords(root);
    if (fromLabelled) {
        return fromLabelled;
    }
    const pageText = (root.innerText || root.textContent || "").slice(0, 5000);
    if (!pageText) {
        return null;
    }
    const fromLabel = extractPatientNameFromText(pageText);
    if (isLikelyValidPatientName(fromLabel)) {
        return fromLabel;
    }
    const sanitized = sanitizePatientName(pageText);
    if (isLikelyValidPatientName(sanitized)) {
        return sanitized;
    }
    return null;
};
const collectCandidateScopes = (select) => {
    const scopes = [];
    const seen = new Set();
    for (const selector of CONTAINER_SELECTORS) {
        const found = select.closest(selector);
        if (found && !seen.has(found)) {
            scopes.push(found);
            seen.add(found);
        }
    }
    let current = select.parentElement;
    let depth = 0;
    while (current && depth < 4) {
        if (!seen.has(current)) {
            scopes.push(current);
            seen.add(current);
        }
        current = current.parentElement;
        depth += 1;
    }
    return scopes;
};
export const resolvePatientNameFromStatusSelect = (select) => {
    const scopes = collectCandidateScopes(select);
    for (const scope of scopes) {
        const fromElements = readFromElements(scope);
        if (fromElements) {
            return fromElements;
        }
        const fromText = readFromScopeText(scope);
        if (fromText) {
            return fromText;
        }
        const fromKeywordLabel = readFromScopeByKeywords(scope);
        if (fromKeywordLabel) {
            return fromKeywordLabel;
        }
    }
    const fromDocument = readFromDocumentFallback();
    if (fromDocument) {
        return fromDocument;
    }
    return null;
};
