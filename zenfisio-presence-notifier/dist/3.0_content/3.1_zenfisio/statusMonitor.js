import { STATUS_LABELS } from "../../1.0_shared/constants.js";
import { formatOutgoingMessage } from "../../1.0_shared/messageFormat.js";
import { containsTriggerStatusLabel, isKnownZenfisioStatusLabel, isTriggerStatusLabel } from "../../1.0_shared/statusOptions.js";
import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../../1.0_shared/patientName.js";
import { normalizeText } from "../../1.0_shared/text.js";
import { isExtensionEnabled } from "./extensionState.js";
import { requestStatusConfirmation } from "./confirmationPrompt.js";
import { sendStatusEvent } from "./messaging.js";
import { showToast } from "./notifications.js";
import { resolvePatientNameFromStatusSelect } from "./patientResolver.js";
const confirmedSet = new Set([
    normalizeText(STATUS_LABELS.CONFIRMED),
    "presenca confirmada"
]);
const cancelledSet = new Set([
    normalizeText(STATUS_LABELS.CANCELLED),
    "nao atendido (sem cobranca)",
    "nao atendido sem cobranca"
]);
const previousValueBySelect = new WeakMap();
const getSelectedLabel = (select) => {
    const option = select.options[select.selectedIndex];
    return (option?.textContent || "").trim();
};
const resolveStatusKind = (normalizedLabel) => {
    if (confirmedSet.has(normalizedLabel)) {
        return "confirmed";
    }
    if (cancelledSet.has(normalizedLabel)) {
        return "cancelled";
    }
    return null;
};
const resolvePatientNameFromContext = (target) => {
    const candidateScopes = [
        target.closest(".popover, [role='dialog'], .modal, [role='menu'], [role='option'], tr, li, article, section, .agendamento, .appointment, .calendar-event"),
        target,
        target.parentElement,
        document.body
    ].filter((value) => value instanceof HTMLElement);
    for (const scope of candidateScopes) {
        const text = (scope.innerText || scope.textContent || "").trim();
        if (!text) {
            continue;
        }
        const extracted = extractPatientNameFromText(text);
        if (isLikelyValidPatientName(extracted)) {
            return extracted;
        }
        const sanitized = sanitizePatientName(text);
        if (isLikelyValidPatientName(sanitized)) {
            return sanitized;
        }
    }
    return null;
};
const isStatusSelect = (select) => {
    const normalizedOptions = Array.from(select.options).map(option => option.textContent || "");
    const knownCount = normalizedOptions.filter(value => isKnownZenfisioStatusLabel(value)).length;
    if (normalizedOptions.some(value => isTriggerStatusLabel(value))) {
        return true;
    }
    if (normalizedOptions.some(value => containsTriggerStatusLabel(value))) {
        return true;
    }
    return knownCount >= 1;
};
const rememberCurrentSelectValue = (event) => {
    const target = event.target;
    const select = target instanceof HTMLSelectElement ? target : target instanceof Element ? target.closest("select") : null;
    if (!(select instanceof HTMLSelectElement)) {
        return;
    }
    if (!isStatusSelect(select)) {
        return;
    }
    previousValueBySelect.set(select, normalizeText(getSelectedLabel(select)));
};
const handleSelectChange = async (event) => {
    if (!event.isTrusted) {
        return;
    }
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
        return;
    }
    if (!isStatusSelect(target)) {
        return;
    }
    const currentNormalized = normalizeText(getSelectedLabel(target));
    const previousNormalized = previousValueBySelect.get(target);
    previousValueBySelect.set(target, currentNormalized);
    if (previousNormalized === currentNormalized) {
        return;
    }
    if (!containsTriggerStatusLabel(currentNormalized)) {
        return;
    }
    const statusKind = resolveStatusKind(currentNormalized);
    if (!statusKind) {
        return;
    }
    if (!isExtensionEnabled()) {
        showToast("Extensao desativada. Ative no card ou com Ctrl+Shift+Z.", "warn");
        return;
    }
    const patientName = resolvePatientNameFromStatusSelect(target) || resolvePatientNameFromContext(target);
    if (!patientName) {
        showToast("Paciente nao identificado. Envio bloqueado para evitar falso positivo.", "warn");
        return;
    }
    const previewMessage = formatOutgoingMessage(statusKind, patientName);
    const confirmed = await requestStatusConfirmation({
        patientName,
        statusKind,
        statusLabel: getSelectedLabel(target),
        previewMessage
    });
    if (!confirmed) {
        showToast("Envio cancelado antes de chegar ao chat.", "warn");
        return;
    }
    try {
        const response = await sendStatusEvent({
            patientName,
            statusKind,
            source: "select-change"
        });
        if (response.ok) {
            showToast(`Enviado para o chat: ${patientName}`, "ok");
            return;
        }
        if (response.skipped === "already-sent-today" || response.skipped === "recent-duplicate") {
            showToast("Envio ignorado por duplicidade.", "warn");
            return;
        }
        if (response.skipped === "invalid-patient-name") {
            showToast("Nome invalido. Envio bloqueado.", "warn");
            return;
        }
        if (response.skipped === "extension-disabled") {
            showToast("Extensao desativada.", "warn");
            return;
        }
        if (response.error) {
            showToast(`Falha ao enviar: ${response.error}`, "error");
        }
    }
    catch (error) {
        showToast(`Falha no envio: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
};
const handleClickTrigger = async (event) => {
    if (!event.isTrusted) {
        return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    if (target.closest("select")) {
        return;
    }
    const text = (target.innerText || target.textContent || "").trim();
    if (!text || !containsTriggerStatusLabel(text)) {
        return;
    }
    if (!isExtensionEnabled()) {
        showToast("Extensao desativada. Ative no card ou com Ctrl+Shift+Z.", "warn");
        return;
    }
    const statusKind = resolveStatusKind(normalizeText(text));
    if (!statusKind) {
        return;
    }
    const patientName = resolvePatientNameFromContext(target);
    if (!patientName) {
        showToast("Paciente nao identificado. Envio bloqueado para evitar falso positivo.", "warn");
        return;
    }
    const previewMessage = formatOutgoingMessage(statusKind, patientName);
    const confirmed = await requestStatusConfirmation({
        patientName,
        statusKind,
        statusLabel: text,
        previewMessage
    });
    if (!confirmed) {
        showToast("Envio cancelado antes de chegar ao chat.", "warn");
        return;
    }
    try {
        const response = await sendStatusEvent({
            patientName,
            statusKind,
            source: "click-trigger"
        });
        if (response.ok) {
            showToast(`Enviado para o chat: ${patientName}`, "ok");
            return;
        }
        if (response.skipped === "already-sent-today" || response.skipped === "recent-duplicate") {
            showToast("Envio ignorado por duplicidade.", "warn");
            return;
        }
        if (response.skipped === "invalid-patient-name") {
            showToast("Nome invalido. Envio bloqueado.", "warn");
            return;
        }
        if (response.skipped === "extension-disabled") {
            showToast("Extensao desativada.", "warn");
            return;
        }
        if (response.error) {
            showToast(`Falha ao enviar: ${response.error}`, "error");
        }
    }
    catch (error) {
        showToast(`Falha no envio: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
};
export const initStatusMonitor = () => {
    document.addEventListener("pointerdown", rememberCurrentSelectValue, true);
    document.addEventListener("focusin", rememberCurrentSelectValue, true);
    document.addEventListener("input", rememberCurrentSelectValue, true);
    document.addEventListener("change", event => {
        void handleSelectChange(event);
    }, true);
    document.addEventListener("click", event => {
        void handleClickTrigger(event);
    }, true);
};
