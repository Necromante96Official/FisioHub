const getSenderUrl = (sender: chrome.runtime.MessageSender): string => {
  return sender.url || sender.tab?.url || "";
};

const getSenderUrls = (sender: chrome.runtime.MessageSender): string[] => {
  return [sender.url, sender.tab?.url].filter((value): value is string => typeof value === "string" && value.length > 0);
};

const hasHost = (sender: chrome.runtime.MessageSender, hosts: string[]): boolean => {
  const rawUrls = getSenderUrls(sender);
  if (rawUrls.length === 0) {
    return false;
  }

  for (const rawUrl of rawUrls) {
    try {
      const url = new URL(rawUrl);
      if (hosts.includes(url.host)) {
        return true;
      }
    } catch {
      // Ignore non-URL sender values such as about:blank frames.
    }
  }

  return false;
};

export const isPopupSender = (sender: chrome.runtime.MessageSender): boolean => {
  const rawUrl = getSenderUrl(sender);
  if (!rawUrl) {
    return false;
  }

  return rawUrl.startsWith(`chrome-extension://${chrome.runtime.id}/`) && rawUrl.includes("/src/ui/popup.html");
};

export const isZenfisioSender = (sender: chrome.runtime.MessageSender): boolean => {
  return hasHost(sender, ["app.zenfisio.com"]);
};

export const isChatSender = (sender: chrome.runtime.MessageSender): boolean => {
  return hasHost(sender, ["mail.google.com", "chat.google.com"]);
};

export const isTrustedStateSender = (sender: chrome.runtime.MessageSender): boolean => {
  return isPopupSender(sender) || isZenfisioSender(sender);
};

export const rejectUntrustedSender = (
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  isAllowed: (sender: chrome.runtime.MessageSender) => boolean
): boolean => {
  if (isAllowed(sender)) {
    return false;
  }

  sendResponse({ ok: false, error: "unauthorized-sender" });
  return true;
};

