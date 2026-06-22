import { injectHighlightStyle } from "./highlight.js";
import { persistAndHighlight, resetPersistedHighlights } from "./highlightPersistence.js";
import { cleanText, extractPatientName, extractTimeRangeStart, isRenewalDue, parseRepeatProgress } from "./repeatParser.js";
const CARD_SELECTORS = [
    ".fc-event",
    ".fc-time-grid-event",
    ".fc-v-event",
    ".fc-h-event",
    "[class*='fc-event']"
];
const DETAIL_SELECTORS = [
    ".popover",
    ".modal",
    ".modal-dialog",
    ".ui-dialog",
    "[role='dialog']",
    "[class*='popover']",
    "[class*='modal']"
];
const ANALYSIS_START_MINUTES = 7 * 60;
const ANALYSIS_END_EXCLUSIVE_MINUTES = 18 * 60;
export const createInitialStatus = () => ({
    running: false,
    totalCards: 0,
    analyzedCards: 0,
    openedDetails: 0,
    foundRepeats: 0,
    highlightedCards: 0,
    message: "Pronto para analisar agendamentos.",
    lastScanIso: ""
});
const wait = (milliseconds) => {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
};
const waitUnlessStopped = async (milliseconds, controller) => {
    const step = 50;
    let elapsed = 0;
    while (elapsed < milliseconds) {
        if (controller.stopRequested)
            return false;
        await wait(Math.min(step, milliseconds - elapsed));
        elapsed += step;
    }
    return !controller.stopRequested;
};
const hideTooltipAttributes = (element) => {
    const hiddenAttributes = [];
    const targets = [element, ...Array.from(element.querySelectorAll("[title], [aria-label]"))];
    for (const target of targets) {
        for (const name of ["title", "aria-label"]) {
            const value = target.getAttribute(name);
            if (!value)
                continue;
            hiddenAttributes.push({ element: target, name, value });
            target.removeAttribute(name);
        }
    }
    return hiddenAttributes;
};
const restoreTooltipAttributes = (cards) => {
    for (const card of cards) {
        for (const item of card.hiddenAttributes) {
            item.element.setAttribute(item.name, item.value);
        }
        card.hiddenAttributes = [];
    }
};
const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width >= 20 &&
        rect.height >= 10 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < window.innerHeight &&
        rect.left < window.innerWidth &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0";
};
const minutesFromTime = (time) => {
    const [hour, minute] = time.split(":").map(Number);
    return hour * 60 + minute;
};
const getElementText = (element) => {
    return cleanText([
        element.innerText,
        element.textContent,
        element.getAttribute("title"),
        element.getAttribute("aria-label"),
        Object.entries(element.dataset).map(([key, value]) => `${key}: ${value ?? ""}`).join(" ")
    ].filter(Boolean).join(" "));
};
export const collectCalendarCards = (options) => {
    const hideTooltips = options?.hideTooltips ?? false;
    const elements = [];
    for (const selector of CARD_SELECTORS) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
            if (!elements.includes(element))
                elements.push(element);
        }
    }
    const uniqueElements = elements.filter(element => {
        return !elements.some(other => other !== element && other.contains(element));
    });
    return uniqueElements
        .filter(isVisible)
        .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = getElementText(element);
        return {
            element,
            text,
            time: extractTimeRangeStart(text),
            top: rect.top,
            left: rect.left,
            hiddenAttributes: []
        };
    })
        .filter((card) => {
        if (!card.time)
            return false;
        const minutes = minutesFromTime(card.time);
        return minutes >= ANALYSIS_START_MINUTES && minutes < ANALYSIS_END_EXCLUSIVE_MINUTES;
    })
        .sort((a, b) => {
        const timeDiff = minutesFromTime(a.time) - minutesFromTime(b.time);
        if (timeDiff !== 0)
            return timeDiff;
        const topDiff = a.top - b.top;
        if (Math.abs(topDiff) > 4)
            return topDiff;
        return a.left - b.left;
    })
        .map(card => {
        if (hideTooltips) {
            card.hiddenAttributes = hideTooltipAttributes(card.element);
        }
        return card;
    });
};
const dispatchClick = (element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const clickTarget = target && element.contains(target) ? target : element;
    const init = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
    };
    clickTarget.dispatchEvent(new PointerEvent("pointerdown", init));
    clickTarget.dispatchEvent(new MouseEvent("mousedown", init));
    clickTarget.dispatchEvent(new PointerEvent("pointerup", init));
    clickTarget.dispatchEvent(new MouseEvent("mouseup", init));
    clickTarget.dispatchEvent(new MouseEvent("click", init));
    clickTarget.click();
};
const closeDetails = () => {
    const closeButtons = Array.from(document.querySelectorAll(".popover .close, .modal .close, [role='dialog'] .close, [data-dismiss='popover'], [data-bs-dismiss='popover'], [data-dismiss='modal'], [data-bs-dismiss='modal'], button[aria-label='Close'], button[aria-label='Fechar']"));
    for (const closeButton of closeButtons) {
        dispatchClick(closeButton);
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
};
const readOpenDetails = () => {
    const details = [];
    for (const selector of DETAIL_SELECTORS) {
        for (const element of Array.from(document.querySelectorAll(selector))) {
            const text = getElementText(element);
            if (!details.includes(element) && isVisible(element) && /repetid/i.test(text) && /paciente/i.test(text)) {
                details.push(element);
            }
        }
    }
    return details.map(element => {
        const text = getElementText(element);
        return {
            patientName: extractPatientName(text),
            time: extractTimeRangeStart(text),
            repeat: parseRepeatProgress(text),
            text
        };
    }).filter(detail => detail.repeat);
};
const samePatient = (cardText, patientName) => {
    if (!patientName)
        return false;
    const normalize = (value) => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const normalizedCard = normalize(cardText);
    const tokens = normalize(patientName).split(/\s+/).filter(token => token.length >= 3);
    return tokens.length > 0 && tokens.slice(0, 3).every(token => normalizedCard.includes(token));
};
const detailMatchesCard = (detail, card) => {
    return detail.time === card.time && samePatient(card.text, detail.patientName);
};
const applyDetailToCards = (detail, cards, highlighted) => {
    if (!detail.repeat || !isRenewalDue(detail.repeat))
        return 0;
    const card = cards.find(candidate => detailMatchesCard(detail, candidate));
    if (!card || highlighted.has(card.element))
        return 0;
    if (!detail.patientName)
        return 0;
    persistAndHighlight(card.element, card.time, detail.patientName, `${detail.repeat.current}/${detail.repeat.total}`);
    highlighted.add(card.element);
    return 1;
};
const waitForDetailsAfterClick = async (card, controller) => {
    for (let attempt = 0; attempt < 14; attempt += 1) {
        if (controller.stopRequested)
            return [];
        const details = readOpenDetails();
        const matchingDetails = details.filter(detail => detailMatchesCard(detail, card));
        if (matchingDetails.length > 0)
            return matchingDetails;
        if (details.length > 0 && attempt >= 6)
            return details;
        if (!await waitUnlessStopped(170, controller))
            return [];
    }
    return [];
};
export const runAppointmentScan = async (onProgress, controller) => {
    injectHighlightStyle();
    resetPersistedHighlights();
    const cards = collectCalendarCards({ hideTooltips: true });
    const highlighted = new Set();
    let status = {
        running: true,
        totalCards: cards.length,
        analyzedCards: 0,
        openedDetails: 0,
        foundRepeats: 0,
        highlightedCards: 0,
        message: `Encontrados ${cards.length} agendamentos entre 07h e 17h.`,
        lastScanIso: new Date().toISOString()
    };
    onProgress(status);
    try {
        for (let index = 0; index < cards.length; index += 1) {
            if (controller.stopRequested)
                break;
            const card = cards[index];
            closeDetails();
            if (!await waitUnlessStopped(280, controller))
                break;
            card.element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
            if (!await waitUnlessStopped(420, controller))
                break;
            dispatchClick(card.element);
            const details = await waitForDetailsAfterClick(card, controller);
            let foundRepeats = 0;
            for (const detail of details) {
                if (detail.repeat)
                    foundRepeats += 1;
                applyDetailToCards(detail, cards, highlighted);
            }
            closeDetails();
            if (!await waitUnlessStopped(360, controller))
                break;
            status = {
                ...status,
                analyzedCards: index + 1,
                openedDetails: status.openedDetails + details.length,
                foundRepeats: status.foundRepeats + foundRepeats,
                highlightedCards: highlighted.size,
                message: `Analisando com calma ${card.time}: ${index + 1} de ${cards.length}.`,
                lastScanIso: new Date().toISOString()
            };
            onProgress(status);
        }
    }
    finally {
        closeDetails();
        restoreTooltipAttributes(cards);
    }
    if (controller.stopRequested) {
        return {
            ...status,
            running: false,
            message: `Analise parada pelo usuario em ${status.analyzedCards} de ${cards.length}.`,
            lastScanIso: new Date().toISOString()
        };
    }
    return {
        ...status,
        running: false,
        message: highlighted.size > 0
            ? `Analise concluida: ${highlighted.size} agendamento(s) precisam renovar.`
            : "Analise concluida: nenhum Repetido completo de 1 a 20 foi encontrado.",
        lastScanIso: new Date().toISOString()
    };
};
