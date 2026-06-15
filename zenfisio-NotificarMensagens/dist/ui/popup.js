import { MESSAGE_TYPES } from "../shared/constants.js";
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
    list.replaceChildren();
    if (!items.length) {
        list.textContent = "Nenhum envio registrado.";
        return;
    }
    for (const item of items) {
        const row = document.createElement("div");
        row.className = "item";
        const info = document.createElement("div");
        const statusLabel = item.statusKind === "confirmed"
            ? "✅ Chegou"
            : item.statusKind === "missed"
                ? "🛑 FALTOU"
                : "❌ DESMARCAÇÃO";
        const patientName = document.createElement("strong");
        patientName.textContent = item.patientName;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `${item.dateKey} - ${statusLabel}`;
        info.appendChild(patientName);
        info.appendChild(meta);
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
    const lastError = byId("lastError");
    if (state.lastError?.message) {
        lastError.classList.add("has-error");
        lastError.textContent = `${state.lastError.occurredAtIso}: ${state.lastError.message}`;
    }
    else {
        lastError.classList.remove("has-error");
        lastError.textContent = "Sem erro recente.";
    }
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
    byId("openZenfisioBtn").addEventListener("click", async () => {
        await request({ type: MESSAGE_TYPES.OPEN_ZENFISIO });
    });
    byId("openChatBtn").addEventListener("click", async () => {
        await request({ type: MESSAGE_TYPES.OPEN_CHAT });
    });
    byId("testChatBtn").addEventListener("click", async () => {
        const response = await request({ type: MESSAGE_TYPES.CHAT_TEST });
        if (!response.ok && response.error) {
            byId("lastError").textContent = response.error;
        }
        await refreshState();
    });
    void refresh();
});
