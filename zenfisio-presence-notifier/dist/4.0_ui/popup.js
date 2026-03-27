import { MESSAGE_TYPES } from "../1.0_shared/constants.js";
const byId = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Elemento nao encontrado: ${id}`);
    }
    return element;
};
const request = (message) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(response);
        });
    });
};
const renderHistory = (items) => {
    const list = byId("list");
    list.innerHTML = "";
    if (!items.length) {
        list.textContent = "Nenhum envio registrado.";
        return;
    }
    for (const item of items) {
        const row = document.createElement("div");
        row.className = "item";
        const info = document.createElement("div");
        const statusLabel = item.statusKind === "confirmed" ? "✅ Chegou" : "❌ DESMARCAÇÃO";
        info.innerHTML = `<strong>${item.patientName}</strong><div class="meta">${item.dateKey} - ${statusLabel}</div>`;
        const actions = document.createElement("div");
        actions.className = "actions";
        const todayBtn = document.createElement("button");
        todayBtn.className = "mini";
        todayBtn.textContent = "Remover dia";
        todayBtn.addEventListener("click", async () => {
            await request({
                type: MESSAGE_TYPES.HISTORY_REMOVE,
                payload: { patientKey: item.patientKey, dateKey: item.dateKey }
            });
            await refresh();
        });
        const allBtn = document.createElement("button");
        allBtn.className = "mini";
        allBtn.textContent = "Remover tudo";
        allBtn.addEventListener("click", async () => {
            await request({
                type: MESSAGE_TYPES.HISTORY_REMOVE,
                payload: { patientKey: item.patientKey, removeAll: true }
            });
            await refresh();
        });
        actions.appendChild(todayBtn);
        actions.appendChild(allBtn);
        row.appendChild(info);
        row.appendChild(actions);
        list.appendChild(row);
    }
};
const refreshState = async () => {
    const state = await request({ type: MESSAGE_TYPES.STATE_QUERY });
    const button = byId("toggleBtn");
    button.textContent = state.enabled ? "Extensao ATIVADA" : "Extensao DESATIVADA";
    button.style.background = state.enabled ? "#1f7a3f" : "#7a1f1f";
};
const refreshHistory = async () => {
    const response = await request({ type: MESSAGE_TYPES.HISTORY_LIST });
    if (!response?.ok) {
        byId("list").textContent = "Falha ao carregar historico.";
        return;
    }
    renderHistory(response.list || []);
};
const refresh = async () => {
    await Promise.all([refreshState(), refreshHistory()]);
};
document.addEventListener("DOMContentLoaded", () => {
    byId("toggleBtn").addEventListener("click", async () => {
        await request({ type: MESSAGE_TYPES.STATE_TOGGLE });
        await refreshState();
    });
    byId("clearBtn").addEventListener("click", async () => {
        const confirmed = window.confirm("Deseja limpar todo o historico?");
        if (!confirmed) {
            return;
        }
        await request({ type: MESSAGE_TYPES.HISTORY_CLEAR });
        await refreshHistory();
    });
    void refresh();
});
