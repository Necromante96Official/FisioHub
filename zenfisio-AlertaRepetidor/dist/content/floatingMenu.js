const STORAGE_KEY = "zra.floatingPosition";
const VISIBLE_STORAGE_KEY = "zra.floatingVisible";
const ROOT_ID = "zra-floating-root";
const STYLE_ID = "zra-floating-style";
const DEFAULT_POSITION = {
    x: 24,
    y: 140
};
const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};
const readPosition = async () => {
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const saved = result[STORAGE_KEY];
        if (typeof saved?.x === "number" && typeof saved.y === "number") {
            return {
                x: clamp(saved.x, 6, window.innerWidth - 58),
                y: clamp(saved.y, 6, window.innerHeight - 58)
            };
        }
    }
    catch {
        // Se o storage falhar, o botao usa a posicao padrao.
    }
    return DEFAULT_POSITION;
};
const savePosition = async (position) => {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY]: position });
    }
    catch {
        // A posicao salva e apenas uma conveniencia visual.
    }
};
const readVisible = async () => {
    try {
        const result = await chrome.storage.local.get(VISIBLE_STORAGE_KEY);
        return result[VISIBLE_STORAGE_KEY] === true;
    }
    catch {
        return false;
    }
};
const saveVisible = async (visible) => {
    try {
        await chrome.storage.local.set({ [VISIBLE_STORAGE_KEY]: visible });
    }
    catch {
        // O atalho continua funcionando mesmo sem persistencia.
    }
};
const waitForBody = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (document.body)
            return document.body;
        await new Promise(resolve => window.setTimeout(resolve, 100));
    }
    return document.documentElement;
};
const injectFloatingStyle = () => {
    if (document.getElementById(STYLE_ID))
        return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      left: 24px;
      top: 140px;
      right: auto;
      bottom: auto;
      width: auto;
      min-width: 0;
      height: auto;
      min-height: 0;
      display: block;
      visibility: visible;
      opacity: 1;
      pointer-events: auto;
      z-index: 2147483647 !important;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #fafafa;
      user-select: none;
      touch-action: none;
      transition: transform 180ms ease, filter 180ms ease, opacity 160ms ease;
    }

    #${ROOT_ID}[data-visible="false"] {
      display: none !important;
    }

    #${ROOT_ID}, #${ROOT_ID} * {
      box-sizing: border-box;
    }

    #${ROOT_ID} .zra-float-button {
      width: 104px;
      height: 104px;
      min-width: 104px;
      min-height: 104px;
      border: 0;
      border-radius: 50%;
      background:
        radial-gradient(circle at 32% 22%, rgba(255, 255, 255, 0.34), transparent 30%),
        radial-gradient(circle at 50% 100%, rgba(59, 130, 246, 0.32), transparent 56%),
        linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
      color: #ffffff;
      cursor: grab;
      display: grid;
      place-items: center;
      font-size: 26px;
      font-weight: 1000;
      letter-spacing: 0.04em;
      filter: drop-shadow(0 14px 24px rgba(0, 0, 0, 0.34));
      box-shadow:
        inset 0 0 0 1px rgba(255, 255, 255, 0.10),
        inset 0 -18px 28px rgba(0, 0, 0, 0.24);
      padding: 0;
      margin: 0;
      text-align: center;
      appearance: none;
      transition: transform 180ms cubic-bezier(.2,.8,.2,1), filter 180ms ease;
      touch-action: none;
    }

    #${ROOT_ID} .zra-float-button:hover,
    #${ROOT_ID}.is-open .zra-float-button {
      transform: translateY(-2px) scale(1.04);
      filter: drop-shadow(0 18px 28px rgba(59, 130, 246, 0.32));
    }

    #${ROOT_ID}.is-dragging .zra-float-button {
      cursor: grabbing;
      transform: scale(0.97);
    }

    #${ROOT_ID} .zra-state-card {
      width: 96px;
      margin: 5px auto 0;
      padding: 5px 8px;
      border-radius: 999px;
      text-align: center;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.04em;
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: linear-gradient(135deg, #2563eb, #60a5fa);
      box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
      transition: background 180ms ease, transform 180ms ease, box-shadow 180ms ease;
    }

    #${ROOT_ID} .zra-menu {
      position: absolute;
      top: 8px;
      left: calc(100% + 12px);
      width: 240px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 42%),
        linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
      box-shadow: 0 22px 48px rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(16px);
      display: grid;
      gap: 8px;
      opacity: 0;
      pointer-events: none;
      transform: translateX(-8px) translateY(8px) scale(0.96);
      transform-origin: top left;
      transition: opacity 180ms ease, transform 220ms cubic-bezier(.2,.8,.2,1);
    }

    #${ROOT_ID}.is-open .zra-menu {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(0) translateY(0) scale(1);
    }

    #${ROOT_ID} .zra-menu-title {
      color: #f4f4f5;
      font-size: 12px;
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 2px;
    }

    #${ROOT_ID} .zra-menu-status {
      color: #c4c4cc;
      font-size: 11px;
      line-height: 1.25;
      margin-bottom: 4px;
      padding: 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    #${ROOT_ID} .zra-menu button {
      width: 100%;
      min-height: 34px;
      border: 0;
      border-radius: 12px;
      cursor: pointer;
      font: 850 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transition: transform 140ms ease, filter 140ms ease, background 140ms ease;
    }

    #${ROOT_ID} .zra-menu button:hover,
    #${ROOT_ID} .zra-menu button:focus-visible {
      transform: translateY(-1px);
      outline: none;
    }

    #${ROOT_ID} .zra-start {
      background: linear-gradient(135deg, #ffffff, #d4d4d8);
      color: #18181b;
    }

    #${ROOT_ID} .zra-stop {
      background: rgba(63, 63, 70, 0.92);
      color: #fafafa;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  `;
    document.documentElement.appendChild(style);
};
const setRootPosition = (root, position) => {
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
};
const updateStatusText = (root, status) => {
    const statusElement = root.querySelector(".zra-menu-status");
    const startButton = root.querySelector(".zra-start");
    const stopButton = root.querySelector(".zra-stop");
    if (statusElement) {
        statusElement.textContent = status.running
            ? `Analisando ${status.analyzedCards}/${status.totalCards}`
            : `${status.highlightedCards} destacado(s)`;
    }
    if (startButton)
        startButton.disabled = status.running;
    if (stopButton)
        stopButton.disabled = !status.running;
};
export const installFloatingMenu = async (actions) => {
    if (document.getElementById(ROOT_ID))
        return;
    injectFloatingStyle();
    const host = await waitForBody();
    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.dataset.visible = String(await readVisible());
    root.innerHTML = `
    <button class="zra-float-button" type="button" aria-label="Alerta Repetidor">AR</button>
    <div class="zra-state-card">Alt + Z</div>
    <div class="zra-menu">
      <div>
        <div class="zra-menu-title">Alerta Repetidor</div>
        <div class="zra-menu-status">Pronto</div>
      </div>
      <button class="zra-start" type="button">Iniciar analise</button>
      <button class="zra-stop" type="button">Parar analise</button>
    </div>
  `;
    host.appendChild(root);
    setRootPosition(root, await readPosition());
    const button = root.querySelector(".zra-float-button");
    const startButton = root.querySelector(".zra-start");
    const stopButton = root.querySelector(".zra-stop");
    if (!button || !startButton || !stopButton)
        return;
    let isDragging = false;
    let moved = false;
    let offsetX = 0;
    let offsetY = 0;
    button.addEventListener("pointerdown", event => {
        isDragging = true;
        moved = false;
        root.classList.add("is-dragging");
        button.setPointerCapture(event.pointerId);
        const rect = root.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
    });
    button.addEventListener("pointermove", event => {
        if (!isDragging)
            return;
        moved = true;
        const position = {
            x: clamp(event.clientX - offsetX, 6, window.innerWidth - 54),
            y: clamp(event.clientY - offsetY, 6, window.innerHeight - 54)
        };
        setRootPosition(root, position);
    });
    button.addEventListener("pointerup", event => {
        if (!isDragging)
            return;
        isDragging = false;
        root.classList.remove("is-dragging");
        button.releasePointerCapture(event.pointerId);
        const rect = root.getBoundingClientRect();
        void savePosition({ x: rect.left, y: rect.top });
        if (!moved)
            root.classList.toggle("is-open");
    });
    startButton.addEventListener("click", () => {
        actions.startScan();
        updateStatusText(root, { ...actions.getStatus(), running: true });
    });
    stopButton.addEventListener("click", () => {
        updateStatusText(root, actions.stopScan());
    });
    window.setInterval(() => {
        updateStatusText(root, actions.getStatus());
    }, 700);
    updateStatusText(root, actions.getStatus());
};
export const toggleFloatingMenuVisibility = async () => {
    const root = document.getElementById(ROOT_ID);
    const nextVisible = root?.dataset.visible !== "true";
    if (root) {
        root.dataset.visible = String(nextVisible);
        if (!nextVisible)
            root.classList.remove("is-open");
    }
    await saveVisible(nextVisible);
    return nextVisible;
};
export const registerFloatingMenuShortcut = () => {
    document.addEventListener("keydown", event => {
        if (!(event.altKey && !event.ctrlKey && !event.shiftKey && (event.key === "Z" || event.key === "z"))) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        void toggleFloatingMenuVisibility();
    }, true);
};
