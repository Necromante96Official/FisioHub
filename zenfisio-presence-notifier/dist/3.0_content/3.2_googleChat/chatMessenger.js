const INPUT_SELECTORS = [
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][aria-label*='Mensagem']",
    "div[contenteditable='true'][aria-label*='message']",
    "div[contenteditable='true'][data-placeholder*='Mensagem']",
    "div[contenteditable='true'][data-placeholder*='message']",
    "div[contenteditable='true'][data-emoji-root='true']",
    "div[contenteditable='true'][data-tab='true']",
    "div[role='combobox'][contenteditable='true']",
    "div.editable[contenteditable='true']",
    "div[contenteditable='true'][aria-label*='Chat']",
    "div[contenteditable='true'][aria-label*='Bate-papo']",
    "[aria-label='Mensagem'][contenteditable='true']",
    "[aria-label*='Enviar mensagem'][contenteditable='true']"
];
const SEND_BUTTON_SELECTORS = [
    "button[aria-label='Enviar mensagem']",
    "button[aria-label='Send message']",
    "button[data-tooltip='Send message']",
    "button[data-tooltip='Enviar mensagem']",
    "button[aria-label*='Enviar'][data-tooltip*='Mensagem']",
    "button[aria-label*='Send'][data-tooltip*='Message']",
    "div[role='button'][aria-label*='Enviar']",
    "div[role='button'][data-tooltip*='Enviar']",
    "div[role='button'][aria-label*='Send']",
    "div[role='button'][data-tooltip*='Send']",
    "span[data-tooltip*='Enviar'] button",
    "span[data-tooltip*='Send'] button"
];
const WAIT_TIMEOUT_MS = 45000;
const isEligibleInput = (element) => {
    if (!element.isContentEditable) {
        return false;
    }
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return false;
    }
    return !element.hasAttribute("aria-hidden");
};
const findVisibleMatch = (collection) => {
    for (let index = 0; index < collection.length; index += 1) {
        const element = collection[index];
        if (element && isEligibleInput(element)) {
            return element;
        }
    }
    return null;
};
const findFirstMatch = () => {
    for (const selector of INPUT_SELECTORS) {
        const candidate = findVisibleMatch(document.querySelectorAll(selector));
        if (candidate) {
            return candidate;
        }
    }
    return findVisibleMatch(document.querySelectorAll("[contenteditable='true']"));
};
const findVisibleEditable = () => {
    return findFirstMatch();
};
const waitForEditableInput = () => {
    return new Promise((resolve, reject) => {
        const existing = findVisibleEditable();
        if (existing) {
            resolve(existing);
            return;
        }
        const observer = new MutationObserver(() => {
            const candidate = findVisibleEditable();
            if (!candidate) {
                return;
            }
            cleanup();
            resolve(candidate);
        });
        const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error("Campo de mensagem do Google Chat nao encontrado."));
        }, WAIT_TIMEOUT_MS);
        const cleanup = () => {
            observer.disconnect();
            window.clearTimeout(timeoutId);
        };
        observer.observe(document.body || document.documentElement, {
            subtree: true,
            childList: true
        });
    });
};
const findSendButton = (input) => {
    const roots = [
        input.closest("footer") || input.parentElement || document,
        input.parentElement || document,
        document
    ];
    for (const root of roots) {
        for (const selector of SEND_BUTTON_SELECTORS) {
            const button = root.querySelector(selector);
            if (!button) {
                continue;
            }
            const disabled = button.getAttribute("aria-disabled") === "true" || button.disabled;
            if (!disabled) {
                return button;
            }
        }
    }
    return null;
};
const setInputText = (input, text) => {
    input.focus();
    try {
        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            range.selectNodeContents(input);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        document.execCommand("delete");
        document.execCommand("insertText", false, text);
    }
    catch {
        input.innerText = text;
    }
    input.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: text, inputType: "insertText" }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
};
const dispatchEnter = (target) => {
    const eventInit = {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    };
    target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
    target.dispatchEvent(new KeyboardEvent("keypress", eventInit));
    target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
};
export const deliverChatMessage = async (messageText) => {
    if (!messageText.trim()) {
        throw new Error("Mensagem vazia.");
    }
    const input = await waitForEditableInput();
    setInputText(input, messageText);
    await new Promise(resolve => window.setTimeout(resolve, 150));
    const sendButton = findSendButton(input);
    if (sendButton) {
        sendButton.click();
        return;
    }
    dispatchEnter(input);
};
