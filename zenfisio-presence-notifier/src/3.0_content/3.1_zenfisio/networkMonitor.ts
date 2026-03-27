import { STATUS_LABELS } from "../../1.0_shared/constants.js";
import { cacheNetworkPatientText, cachePatientNameFromText } from "./networkPatientCache.js";

let initialized = false;

const MAX_CAPTURE_LENGTH = 20000;

export const initNetworkMonitor = (): void => {
  if (initialized) {
    return;
  }

  initialized = true;

  try {
    hookFetch();
    hookXMLHttpRequest();
  } catch (error) {
    console.warn("Falha ao instalar monitor de rede", error);
  }
};

const hookFetch = (): void => {
  const originalFetch = window.fetch;
  if (!originalFetch) {
    return;
  }

  window.fetch = async (...args) => {
    const response = await originalFetch.apply(window, args as Parameters<typeof originalFetch>);

    try {
      const url = typeof args[0] === "string" ? args[0] : args[0] && typeof args[0] === "object" && "url" in args[0] ? String((args[0] as Request).url) : "";
      if (!shouldInspectUrl(url)) {
        return response;
      }

      const clone = response.clone();
      void extractFromResponse(url, () => clone.text());
    } catch (error) {
      console.debug("Falha no monitor de fetch", error);
    }

    return response;
  };
};

const hookXMLHttpRequest = (): void => {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: unknown[]) {
    (this as XMLHttpRequest & { __zenfisioUrl?: string }).__zenfisioUrl = url;
    return (originalOpen as (...args: unknown[]) => unknown).apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args: unknown[]) {
    const xhr = this as XMLHttpRequest & { __zenfisioUrl?: string };
    const requestUrl = xhr.__zenfisioUrl || "";
    if (shouldInspectUrl(requestUrl)) {
      xhr.addEventListener("load", function () {
        void extractFromResponse(requestUrl, () => Promise.resolve(xhr.responseText));
      });
    }

    return (originalSend as (...sendArgs: unknown[]) => unknown).apply(this, args);
  };
};

const extractFromResponse = async (url: string, textProvider: () => Promise<string>): Promise<void> => {
  try {
    const body = await textProvider();
    if (!body) {
      return;
    }

    const sample = body.slice(0, MAX_CAPTURE_LENGTH);
    cacheNetworkPatientText(sample);
    cachePatientNameFromText(sample);
  } catch (error) {
    console.debug("Falha ao extrair paciente do response", error, url);
  }
};

const shouldInspectUrl = (url: string): boolean => {
  if (!url || typeof url !== "string") {
    return false;
  }

  return url.includes("zenfisio");
};