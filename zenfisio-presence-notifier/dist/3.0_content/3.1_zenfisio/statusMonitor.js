import { STATUS_LABELS } from "../../1.0_shared/constants.js";
import { normalizeText } from "../../1.0_shared/text.js";
import { isExtensionEnabled } from "./extensionState.js";
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
const isStatusSelect = (select) => {
    const allNormalized = Array.from(select.options).map(option => normalizeText(option.textContent || ""));
    return allNormalized.some(value => confirmedSet.has(value) || cancelledSet.has(value));
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
    if (!previousNormalized || previousNormalized === currentNormalized) {
        return;
    }
    const statusKind = resolveStatusKind(currentNormalized);
    if (!statusKind) {
        return;
    }
    if (!isExtensionEnabled()) {
        return;
    }
    const patientName = resolvePatientNameFromStatusSelect(target);
    if (!patientName) {
        showToast("Paciente nao identificado. Envio bloqueado para evitar falso positivo.", "warn");
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
export const initStatusMonitor = () => {
    document.addEventListener("pointerdown", rememberCurrentSelectValue, true);
    document.addEventListener("focusin", rememberCurrentSelectValue, true);
    document.addEventListener("change", event => {
        void handleSelectChange(event);
    }, true);
};
