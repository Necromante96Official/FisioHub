import {
  addPersistedHighlight,
  cardMatchesHighlight,
  clearPersistedHighlights,
  getPersistedHighlights,
} from "./highlightRegistry.js";
import { clearHighlights, highlightCard, highlightCardIfNeeded, injectHighlightStyle, isCardHighlighted } from "./highlight.js";

type CalendarCardLike = {
  element: HTMLElement;
  text: string;
  time: string;
};

const HIGHLIGHT_STYLE_ID = "zra-highlight-style";

let observer: MutationObserver | null = null;
let reapplyTimer: number | undefined;
let isReapplying = false;

export const persistAndHighlight = (
  card: HTMLElement,
  time: string,
  patientName: string,
  label: string
): void => {
  addPersistedHighlight({ time, patientName, label });
  highlightCard(card, label);
};

export const resetPersistedHighlights = (): void => {
  clearPersistedHighlights();
  clearHighlights();
};

const isOwnMutationTarget = (target: Node): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.id === HIGHLIGHT_STYLE_ID) return true;
  if (target.id === "zra-floating-root" || target.closest("#zra-floating-root")) return true;
  return false;
};

const mutationNeedsReapply = (mutations: MutationRecord[]): boolean => {
  return mutations.some(mutation => {
    if (isOwnMutationTarget(mutation.target)) return false;

    if (mutation.type === "attributes" && mutation.attributeName === "class") {
      const target = mutation.target;
      if (target instanceof HTMLElement && target.classList.contains("fc-event")) {
        return true;
      }
      return false;
    }

    return mutation.type === "childList";
  });
};

export const hasMissingHighlights = (collectCards: () => CalendarCardLike[]): boolean => {
  const persisted = getPersistedHighlights();
  if (persisted.length === 0) return false;

  const cards = collectCards();
  return persisted.some(entry => {
    const card = cards.find(candidate => cardMatchesHighlight(candidate.text, candidate.time, entry));
    return Boolean(card && !isCardHighlighted(card.element, entry.label));
  });
};

export const reapplyPersistedHighlights = (collectCards: () => CalendarCardLike[]): number => {
  const persisted = getPersistedHighlights();
  if (persisted.length === 0) return 0;

  isReapplying = true;
  injectHighlightStyle();

  const cards = collectCards();
  let applied = 0;

  try {
    for (const entry of persisted) {
      const card = cards.find(candidate => cardMatchesHighlight(candidate.text, candidate.time, entry));
      if (!card) continue;

      if (highlightCardIfNeeded(card.element, entry.label)) {
        applied += 1;
      }
    }
  } finally {
    window.requestAnimationFrame(() => {
      isReapplying = false;
    });
  }

  return applied;
};

const scheduleReapply = (collectCards: () => CalendarCardLike[]): void => {
  if (isReapplying || getPersistedHighlights().length === 0) return;

  window.clearTimeout(reapplyTimer);
  reapplyTimer = window.setTimeout(() => {
    reapplyPersistedHighlights(collectCards);
  }, 320);
};

export const startHighlightPersistence = (collectCards: () => CalendarCardLike[]): void => {
  if (observer) return;

  observer = new MutationObserver(mutations => {
    if (isReapplying || !mutationNeedsReapply(mutations)) return;
    scheduleReapply(collectCards);
  });

  const startObserver = (): void => {
    if (!document.body || observer === null) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  };

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  }

  window.addEventListener("resize", () => {
    if (hasMissingHighlights(collectCards)) {
      scheduleReapply(collectCards);
    }
  });
};

export const startHighlightFallbackCheck = (collectCards: () => CalendarCardLike[]): void => {
  window.setInterval(() => {
    if (hasMissingHighlights(collectCards)) {
      reapplyPersistedHighlights(collectCards);
    }
  }, 8000);
};
