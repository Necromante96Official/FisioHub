let activePrompt = null;
const STYLE_ID = "zenfisio-confirmation-style";
const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) {
        return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .zenfisio-confirm-backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: grid;
      place-items: center;
      background: rgba(7, 10, 20, 0.72);
      backdrop-filter: blur(6px);
      padding: 20px;
    }

    .zenfisio-confirm-card {
      width: min(560px, calc(100vw - 32px));
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: linear-gradient(180deg, rgba(18, 24, 36, 0.98), rgba(10, 14, 22, 0.98));
      color: #fff;
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
      padding: 24px;
      display: grid;
      gap: 16px;
      transform: translateY(10px) scale(0.98);
      animation: zenfisio-confirm-enter 180ms ease-out forwards;
      font-family: Segoe UI, Arial, sans-serif;
    }

    @keyframes zenfisio-confirm-enter {
      to {
        transform: translateY(0) scale(1);
      }
    }

    .zenfisio-confirm-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .zenfisio-confirm-badge.confirmed {
      background: rgba(46, 125, 50, 0.22);
      color: #9effb0;
    }

    .zenfisio-confirm-badge.cancelled {
      background: rgba(198, 40, 40, 0.22);
      color: #ffb0b0;
    }

    .zenfisio-confirm-title {
      margin: 0;
      font-size: 26px;
      line-height: 1.1;
      font-weight: 900;
      letter-spacing: -0.03em;
    }

    .zenfisio-confirm-copy {
      margin: 0;
      font-size: 15px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.82);
    }

    .zenfisio-confirm-focus {
      border-radius: 18px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: grid;
      gap: 8px;
    }

    .zenfisio-confirm-line {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.78);
    }

    .zenfisio-confirm-value {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
    }

    .zenfisio-confirm-preview {
      margin: 0;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(0, 0, 0, 0.26);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #f7f9ff;
      font-size: 18px;
      line-height: 1.35;
      font-weight: 800;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .zenfisio-confirm-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: center;
      margin-top: 4px;
    }

    .zenfisio-confirm-btn {
      min-width: 160px;
      border: none;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      transition: transform 120ms ease, opacity 120ms ease, box-shadow 120ms ease;
    }

    .zenfisio-confirm-btn:hover {
      transform: translateY(-1px);
    }

    .zenfisio-confirm-btn:focus-visible {
      outline: 3px solid rgba(255, 255, 255, 0.35);
      outline-offset: 2px;
    }

    .zenfisio-confirm-btn.confirm {
      background: linear-gradient(135deg, #2e7d32, #43a047);
      color: #fff;
      box-shadow: 0 12px 24px rgba(46, 125, 50, 0.36);
    }

    .zenfisio-confirm-btn.cancel {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .zenfisio-confirm-hint {
      text-align: center;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
    }
  `;
    document.head.appendChild(style);
};
export const requestStatusConfirmation = async (request) => {
    if (activePrompt) {
        return activePrompt;
    }
    activePrompt = new Promise(resolve => {
        ensureStyles();
        const previousOverflow = document.documentElement.style.overflow;
        const previousActiveElement = document.activeElement;
        document.documentElement.style.overflow = "hidden";
        const backdrop = document.createElement("div");
        backdrop.className = "zenfisio-confirm-backdrop";
        const card = document.createElement("section");
        card.className = "zenfisio-confirm-card";
        card.setAttribute("role", "dialog");
        card.setAttribute("aria-modal", "true");
        card.setAttribute("aria-labelledby", "zenfisio-confirm-title");
        const badge = document.createElement("div");
        badge.className = `zenfisio-confirm-badge ${request.statusKind}`;
        badge.textContent = request.statusKind === "confirmed" ? "Confirmação de presença" : "Confirmação de desmarcação";
        const title = document.createElement("h2");
        title.id = "zenfisio-confirm-title";
        title.className = "zenfisio-confirm-title";
        title.textContent = request.statusKind === "confirmed"
            ? "Confirmar envio desta presença ao chat?"
            : "Confirmar envio desta desmarcação ao chat?";
        const copy = document.createElement("p");
        copy.className = "zenfisio-confirm-copy";
        copy.textContent = "A mensagem ainda nao foi enviada. Confirme apenas se o texto abaixo estiver correto.";
        const focusBox = document.createElement("div");
        focusBox.className = "zenfisio-confirm-focus";
        const patientLine = document.createElement("div");
        patientLine.className = "zenfisio-confirm-line";
        patientLine.textContent = "Paciente identificado";
        const patientValue = document.createElement("div");
        patientValue.className = "zenfisio-confirm-value";
        patientValue.textContent = request.patientName;
        const statusLine = document.createElement("div");
        statusLine.className = "zenfisio-confirm-line";
        statusLine.textContent = "Status selecionado";
        const statusValue = document.createElement("div");
        statusValue.className = "zenfisio-confirm-value";
        statusValue.textContent = request.statusLabel;
        const previewLabel = document.createElement("div");
        previewLabel.className = "zenfisio-confirm-line";
        previewLabel.textContent = "Mensagem que sera enviada";
        const previewValue = document.createElement("pre");
        previewValue.className = "zenfisio-confirm-preview";
        previewValue.textContent = request.previewMessage;
        focusBox.appendChild(patientLine);
        focusBox.appendChild(patientValue);
        focusBox.appendChild(statusLine);
        focusBox.appendChild(statusValue);
        focusBox.appendChild(previewLabel);
        focusBox.appendChild(previewValue);
        const actions = document.createElement("div");
        actions.className = "zenfisio-confirm-actions";
        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "zenfisio-confirm-btn confirm";
        confirmButton.textContent = request.statusKind === "confirmed" ? "Confirmar presença e enviar" : "Confirmar desmarcação e enviar";
        confirmButton.setAttribute("aria-label", confirmButton.textContent);
        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "zenfisio-confirm-btn cancel";
        cancelButton.textContent = "Cancelar com Esc";
        cancelButton.setAttribute("aria-label", cancelButton.textContent);
        const hint = document.createElement("div");
        hint.className = "zenfisio-confirm-hint";
        hint.textContent = "Pressione Enter para confirmar, Esc para cancelar.";
        actions.appendChild(confirmButton);
        actions.appendChild(cancelButton);
        card.appendChild(badge);
        card.appendChild(title);
        card.appendChild(copy);
        card.appendChild(focusBox);
        card.appendChild(actions);
        card.appendChild(hint);
        backdrop.appendChild(card);
        document.body.appendChild(backdrop);
        confirmButton.focus({ preventScroll: true });
        const focusables = [confirmButton, cancelButton];
        const trapFocus = (event) => {
            if (event.key !== "Tab") {
                return;
            }
            event.preventDefault();
            const currentIndex = focusables.indexOf(document.activeElement);
            const nextIndex = event.shiftKey
                ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
                : (currentIndex < 0 || currentIndex === focusables.length - 1 ? 0 : currentIndex + 1);
            focusables[nextIndex].focus({ preventScroll: true });
        };
        const cleanup = (result) => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("keydown", trapFocus, true);
            backdrop.removeEventListener("click", onBackdropClick);
            confirmButton.removeEventListener("click", onConfirm);
            cancelButton.removeEventListener("click", onCancel);
            document.documentElement.style.overflow = previousOverflow;
            backdrop.remove();
            previousActiveElement?.focus?.({ preventScroll: true });
            activePrompt = null;
            resolve(result);
        };
        const onConfirm = () => {
            cleanup(true);
        };
        const onCancel = () => {
            cleanup(false);
        };
        const onBackdropClick = (event) => {
            if (event.target === backdrop) {
                cleanup(false);
            }
        };
        const onKeyDown = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                cleanup(true);
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                cleanup(false);
            }
        };
        confirmButton.addEventListener("click", onConfirm);
        cancelButton.addEventListener("click", onCancel);
        backdrop.addEventListener("click", onBackdropClick);
        window.addEventListener("keydown", trapFocus, true);
        window.addEventListener("keydown", onKeyDown, true);
    });
    return activePrompt;
};
