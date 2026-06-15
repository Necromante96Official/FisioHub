chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-collector") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.id) {
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: "ZFC_TOGGLE_COLLECTOR" }, () => {
      void chrome.runtime.lastError;
    });
  });
});
