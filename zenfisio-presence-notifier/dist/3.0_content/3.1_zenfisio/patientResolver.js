import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../../1.0_shared/patientName.js";
const FIELD_SELECTORS = [
    "[data-field='paciente']",
    "[data-field='patient']",
    "[data-field='nome']",
    "[data-field='name']",
    ".patient-name",
    ".paciente-nome",
    ".nome-paciente",
    ".paciente",
    "[class*='paciente']",
    "[class*='patient']",
    "[class*='nome']",
    "[class*='name']",
    "[id*='paciente']",
    "[id*='patient']",
    "[id*='nome']",
    "[id*='name']",
    "[data-testid*='patient']",
    "[data-testid*='paciente']",
    "[data-testid*='nome']",
    "[data-testid*='name']",
    "[aria-label*='patient']",
    "[aria-label*='paciente']",
    "[aria-label*='nome']",
    "[aria-label*='name']",
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
const OVERLAY_SELECTORS = [
    ".popover",
    "[role='dialog']",
    ".modal",
    ".fc-popover",
    ".ui-dialog",
    ".dropdown-menu"
];
const toCandidate = (value, mode = "generic") => {
    const fromLabel = extractPatientNameFromText(value);
    if (fromLabel && isLikelyValidPatientName(fromLabel)) {
        return fromLabel;
    }
    if (mode === "field") {
        const sanitized = sanitizePatientName(value);
        if (isLikelyValidPatientName(sanitized)) {
            return sanitized;
        }
    }
    return null;
};
const isVisibleElement = (element) => {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};
const hasPatientLabel = (text) => /\b(paciente|patient)\b/i.test(text);
const readFromPatientAnchors = (scope) => {
    const anchors = Array.from(scope.querySelectorAll("a"));
    for (const anchor of anchors) {
        const rawText = (anchor.textContent || "").trim();
        if (!rawText) {
            continue;
        }
        const candidate = sanitizePatientName(rawText);
        if (!isLikelyValidPatientName(candidate)) {
            continue;
        }
        const parentText = (anchor.parentElement?.textContent || "").trim();
        const grandParentText = (anchor.parentElement?.parentElement?.textContent || "").trim();
        if (hasPatientLabel(parentText) || hasPatientLabel(grandParentText)) {
            return candidate;
        }
    }
    return null;
};
const readFromTextSample = (sample) => {
    if (!sample) {
        return null;
    }
    const lines = sample
        .split(/[\n\r|•·]+/)
        .map(segment => segment.trim())
        .filter(Boolean);
    for (const line of lines) {
        const candidate = toCandidate(line, "generic");
        if (candidate) {
            return candidate;
        }
    }
    return toCandidate(sample, "generic");
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
        const candidate = toCandidate(text, "generic");
        if (candidate) {
            return candidate;
        }
    }
    return null;
};
const readFromElements = (scope) => {
    const fromAnchor = readFromPatientAnchors(scope);
    if (fromAnchor) {
        return fromAnchor;
    }
    for (const selector of FIELD_SELECTORS) {
        const elements = Array.from(scope.querySelectorAll(selector));
        for (const element of elements) {
            const text = (element.textContent || "").trim();
            if (!text) {
                continue;
            }
            const candidate = toCandidate(text, "field");
            if (candidate) {
                return candidate;
            }
        }
    }
    return null;
};
const readFromScopeByKeywords = (scope) => {
    const keywords = ["paciente", "patient"];
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
    return extractPatientNameFromText(text);
};
const resolvePatientNameInScope = (scope) => {
    const fromElements = readFromElements(scope);
    if (fromElements) {
        return fromElements;
    }
    if (scope instanceof HTMLElement) {
        const fromText = readFromScopeText(scope);
        if (fromText) {
            return fromText;
        }
    }
    const fromLabelled = readFromScopeByKeywords(scope);
    if (fromLabelled) {
        return fromLabelled;
    }
    return null;
};
export const resolvePatientNameFromScope = (scope) => {
    if (!scope) {
        return null;
    }
    return resolvePatientNameInScope(scope);
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
    if (pageText) {
        const pageCandidate = extractPatientNameFromText(pageText);
        if (isLikelyValidPatientName(pageCandidate)) {
            return pageCandidate;
        }
    }
    return null;
};
const collectCandidateScopes = (select) => {
    const scopes = [];
    const seen = new Set();
    const addScope = (value) => {
        if (!(value instanceof HTMLElement)) {
            return;
        }
        if (seen.has(value)) {
            return;
        }
        scopes.push(value);
        seen.add(value);
    };
    for (const selector of CONTAINER_SELECTORS) {
        addScope(select.closest(selector));
    }
    let current = select.parentElement;
    let depth = 0;
    while (current && depth < 12) {
        addScope(current);
        addScope(current.previousElementSibling);
        addScope(current.nextElementSibling);
        current = current.parentElement;
        depth += 1;
    }
    const selectRect = select.getBoundingClientRect();
    const selectCenterX = selectRect.left + selectRect.width / 2;
    const selectCenterY = selectRect.top + selectRect.height / 2;
    const rankedOverlays = [];
    for (const selector of OVERLAY_SELECTORS) {
        const overlays = Array.from(document.querySelectorAll(selector));
        for (const overlay of overlays) {
            if (!(overlay instanceof HTMLElement)) {
                continue;
            }
            if (!isVisibleElement(overlay)) {
                continue;
            }
            const text = (overlay.innerText || overlay.textContent || "").trim();
            if (!hasPatientLabel(text)) {
                continue;
            }
            const rect = overlay.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.hypot(centerX - selectCenterX, centerY - selectCenterY);
            rankedOverlays.push({ element: overlay, distance });
        }
    }
    rankedOverlays
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .forEach(item => addScope(item.element));
    return scopes;
};
export const resolvePatientNameFromStatusSelect = (select) => {
    const scopes = collectCandidateScopes(select);
    for (const scope of scopes) {
        const resolved = resolvePatientNameInScope(scope);
        if (resolved) {
            return resolved;
        }
    }
    const fromDocument = readFromDocumentFallback();
    if (fromDocument) {
        return fromDocument;
    }
    return null;
};
