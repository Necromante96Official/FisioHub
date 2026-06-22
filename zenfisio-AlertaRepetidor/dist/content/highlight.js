export const HIGHLIGHT_CLASS = "zra-renewal-highlight";
const STYLE_ID = "zra-highlight-style";
const LABEL_ATTR = "data-zra-label";
export const injectHighlightStyle = () => {
    if (document.getElementById(STYLE_ID))
        return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    .${HIGHLIGHT_CLASS} {
      position: relative !important;
      overflow: hidden !important;
      background-image:
        linear-gradient(115deg, transparent 0%, transparent 36%, rgba(255, 255, 255, 0.78) 48%, transparent 62%, transparent 100%) !important;
      background-size: 260% 100% !important;
      animation: zraSweep 3.15s linear infinite !important;
      will-change: background-position !important;
      transform: translateZ(0) !important;
      backface-visibility: hidden !important;
      z-index: 2147483000 !important;
    }

    .${HIGHLIGHT_CLASS}::before {
      content: none !important;
    }

    .${HIGHLIGHT_CLASS}::after {
      content: none !important;
    }

    @keyframes zraSweep {
      0% { background-position: 220% 0; }
      100% { background-position: -120% 0; }
    }
  `;
    document.documentElement.appendChild(style);
};
export const clearHighlights = () => {
    document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(card => {
        card.classList.remove(HIGHLIGHT_CLASS);
        card.removeAttribute(LABEL_ATTR);
    });
};
export const isCardHighlighted = (card, label) => {
    return card.classList.contains(HIGHLIGHT_CLASS) && card.getAttribute(LABEL_ATTR) === label;
};
export const highlightCard = (card, label) => {
    if (isCardHighlighted(card, label))
        return;
    if (card.classList.contains(HIGHLIGHT_CLASS)) {
        card.classList.remove(HIGHLIGHT_CLASS);
        void card.offsetWidth;
    }
    card.classList.add(HIGHLIGHT_CLASS);
    card.setAttribute(LABEL_ATTR, label);
};
export const highlightCardIfNeeded = (card, label) => {
    if (isCardHighlighted(card, label))
        return false;
    highlightCard(card, label);
    return true;
};
