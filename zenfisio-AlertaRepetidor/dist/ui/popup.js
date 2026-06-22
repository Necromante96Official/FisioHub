"use strict";
const $ = (id) => {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`Elemento nao encontrado: ${id}`);
    return element;
};
const sendToTab = async (message) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id)
        return null;
    try {
        return await chrome.tabs.sendMessage(tab.id, message);
    }
    catch {
        return null;
    }
};
const formatTime = (iso) => {
    if (!iso)
        return "-";
    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    }).format(new Date(iso));
};
const setText = (id, value) => {
    $(id).textContent = String(value);
};
const render = (status) => {
    if (!status) {
        $("message").textContent = "Abra a agenda do ZenFisio antes de analisar.";
        return;
    }
    $("message").textContent = status.message;
    setText("totalCards", status.totalCards);
    setText("analyzedCards", status.analyzedCards);
    setText("openedDetails", status.openedDetails);
    setText("foundRepeats", status.foundRepeats);
    setText("highlightedCards", status.highlightedCards);
    setText("lastScanIso", formatTime(status.lastScanIso));
    const button = $("startScan");
    const stopButton = $("stopScan");
    button.disabled = status.running;
    button.textContent = status.running ? "Analisando..." : "Analisar com calma";
    stopButton.disabled = !status.running;
};
let refreshTimer;
const refresh = async () => {
    const status = await sendToTab({ type: "ZRA_GET_STATUS" });
    render(status);
    window.clearTimeout(refreshTimer);
    if (status?.running) {
        refreshTimer = window.setTimeout(() => {
            void refresh();
        }, 650);
    }
};
$("startScan").addEventListener("click", async () => {
    render({
        running: true,
        totalCards: 0,
        analyzedCards: 0,
        openedDetails: 0,
        foundRepeats: 0,
        highlightedCards: 0,
        message: "Iniciando analise com velocidade reduzida...",
        lastScanIso: new Date().toISOString()
    });
    void sendToTab({ type: "ZRA_START_SCAN" });
    window.setTimeout(() => {
        void refresh();
    }, 500);
});
$("stopScan").addEventListener("click", async () => {
    render(await sendToTab({ type: "ZRA_STOP_SCAN" }));
    window.setTimeout(() => {
        void refresh();
    }, 500);
});
void refresh();
