const promisify = (fn, ...args) => {
    return new Promise((resolve, reject) => {
        fn(...args, (result) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                reject(new Error(lastError.message));
                return;
            }
            resolve(result);
        });
    });
};
export const queryTabs = (queryInfo) => {
    return promisify(chrome.tabs.query, queryInfo);
};
export const createTab = (createProperties) => {
    return promisify(chrome.tabs.create, createProperties);
};
export const getTab = (tabId) => {
    return promisify(chrome.tabs.get, tabId);
};
export const sendMessageToTab = (tabId, message) => {
    return promisify(chrome.tabs.sendMessage, tabId, message);
};
export const storageGet = (keys) => {
    return promisify(chrome.storage.local.get, keys);
};
export const storageSet = (value) => {
    return promisify(chrome.storage.local.set, value);
};
export const storageRemove = (keys) => {
    return promisify(chrome.storage.local.remove, keys);
};
export const setBadge = async (enabled) => {
    await promisify(chrome.action.setBadgeText, { text: enabled ? "ON" : "OFF" });
    await promisify(chrome.action.setBadgeBackgroundColor, { color: enabled ? "#2E7D32" : "#C62828" });
};
export const waitForTabComplete = (tabId, timeoutMs = 15000) => {
    return new Promise((resolve, reject) => {
        let settled = false;
        const completeNow = () => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve();
        };
        const failNow = (error) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            reject(error);
        };
        const onUpdated = (updatedTabId, changeInfo) => {
            if (updatedTabId !== tabId) {
                return;
            }
            if (changeInfo.status === "complete") {
                completeNow();
            }
        };
        const timeoutId = setTimeout(() => {
            failNow(new Error("Timeout aguardando carregamento da aba."));
        }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timeoutId);
            chrome.tabs.onUpdated.removeListener(onUpdated);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
        void getTab(tabId)
            .then(tab => {
            if (tab.status === "complete") {
                completeNow();
            }
        })
            .catch(error => {
            failNow(error instanceof Error ? error : new Error(String(error)));
        });
    });
};
