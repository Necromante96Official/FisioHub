const promisify = <TResult>(
  fn: (...args: any[]) => void,
  ...args: any[]
): Promise<TResult> => {
  return new Promise((resolve, reject) => {
    fn(...args, (result: TResult) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(result);
    });
  });
};

export const queryTabs = (queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => {
  return promisify<chrome.tabs.Tab[]>(chrome.tabs.query.bind(chrome.tabs), queryInfo);
};

export const createTab = (createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> => {
  return promisify<chrome.tabs.Tab>(chrome.tabs.create.bind(chrome.tabs), createProperties);
};

export const getTab = (tabId: number): Promise<chrome.tabs.Tab> => {
  return promisify<chrome.tabs.Tab>(chrome.tabs.get.bind(chrome.tabs), tabId);
};

export const sendMessageToTab = <TResponse = unknown>(tabId: number, message: unknown): Promise<TResponse> => {
  return promisify<TResponse>(chrome.tabs.sendMessage.bind(chrome.tabs), tabId, message);
};

export const storageGet = <TData extends Record<string, unknown>>(keys: string[]): Promise<TData> => {
  return promisify<TData>(chrome.storage.local.get.bind(chrome.storage.local), keys);
};

export const storageSet = (value: Record<string, unknown>): Promise<void> => {
  return promisify<void>(chrome.storage.local.set.bind(chrome.storage.local), value);
};

export const storageRemove = (keys: string[]): Promise<void> => {
  return promisify<void>(chrome.storage.local.remove.bind(chrome.storage.local), keys);
};

export const setBadge = async (enabled: boolean): Promise<void> => {
  await promisify<void>(chrome.action.setBadgeText.bind(chrome.action), { text: enabled ? "ON" : "OFF" });
  await promisify<void>(chrome.action.setBadgeBackgroundColor.bind(chrome.action), { color: enabled ? "#2E7D32" : "#C62828" });
};

export const waitForTabComplete = (tabId: number, timeoutMs = 15000): Promise<void> => {
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

    const failNow = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      updatedTabId,
      changeInfo
    ) => {
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
