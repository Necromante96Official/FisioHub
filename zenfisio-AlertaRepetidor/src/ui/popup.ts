type ScanStatus = {
  running: boolean;
  totalCards: number;
  analyzedCards: number;
  openedDetails: number;
  foundRepeats: number;
  highlightedCards: number;
  message: string;
  lastScanIso: string;
};

type RuntimeMessage =
  | { type: "ZRA_GET_STATUS" }
  | { type: "ZRA_START_SCAN" }
  | { type: "ZRA_STOP_SCAN" };

const $ = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento nao encontrado: ${id}`);
  return element as T;
};

const sendToTab = async (message: RuntimeMessage): Promise<ScanStatus | null> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null;
  }
};

const formatTime = (iso: string): string => {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(iso));
};

const setText = (id: string, value: string | number): void => {
  $(id).textContent = String(value);
};

const render = (status: ScanStatus | null): void => {
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

  const button = $<HTMLButtonElement>("startScan");
  const stopButton = $<HTMLButtonElement>("stopScan");
  button.disabled = status.running;
  button.textContent = status.running ? "Analisando..." : "Analisar com calma";
  stopButton.disabled = !status.running;
};

let refreshTimer: number | undefined;

const refresh = async (): Promise<void> => {
  const status = await sendToTab({ type: "ZRA_GET_STATUS" });
  render(status);

  window.clearTimeout(refreshTimer);
  if (status?.running) {
    refreshTimer = window.setTimeout(() => {
      void refresh();
    }, 650);
  }
};

$<HTMLButtonElement>("startScan").addEventListener("click", async () => {
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

$<HTMLButtonElement>("stopScan").addEventListener("click", async () => {
  render(await sendToTab({ type: "ZRA_STOP_SCAN" }));
  window.setTimeout(() => {
    void refresh();
  }, 500);
});

void refresh();
