import { extractPatientNameFromText, isLikelyValidPatientName, sanitizePatientName } from "../../1.0_shared/patientName.js";

const FIELD_SELECTORS = [
  "[data-field='paciente']",
  "[data-field='patient']",
  "[class*='paciente']",
  "[class*='patient']",
  "[id*='paciente']",
  "[id*='patient']",
  "a[href*='paciente']",
  "a[href*='patient']"
] as const;

const CONTAINER_SELECTORS = [
  ".popover",
  "[role='dialog']",
  ".modal",
  "tr",
  "li",
  "article",
  "section",
  ".agendamento",
  ".appointment",
  ".calendar-event"
] as const;

const toCandidate = (value: string): string | null => {
  const fromLabel = extractPatientNameFromText(value);
  if (fromLabel && isLikelyValidPatientName(fromLabel)) {
    return fromLabel;
  }

  const sanitized = sanitizePatientName(value);
  if (isLikelyValidPatientName(sanitized)) {
    return sanitized;
  }

  return null;
};

const readFromElements = (scope: ParentNode): string | null => {
  for (const selector of FIELD_SELECTORS) {
    const elements = Array.from(scope.querySelectorAll(selector));
    for (const element of elements) {
      const text = (element.textContent || "").trim();
      if (!text) {
        continue;
      }

      const candidate = toCandidate(text);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
};

const readFromScopeText = (scope: HTMLElement): string | null => {
  const text = (scope.innerText || scope.textContent || "").slice(0, 2500);
  if (!text) {
    return null;
  }

  return toCandidate(text);
};

const collectCandidateScopes = (select: HTMLSelectElement): HTMLElement[] => {
  const scopes: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const selector of CONTAINER_SELECTORS) {
    const found = select.closest(selector);
    if (found && !seen.has(found as HTMLElement)) {
      scopes.push(found as HTMLElement);
      seen.add(found as HTMLElement);
    }
  }

  let current: HTMLElement | null = select.parentElement;
  let depth = 0;
  while (current && depth < 4) {
    if (!seen.has(current)) {
      scopes.push(current);
      seen.add(current);
    }
    current = current.parentElement;
    depth += 1;
  }

  return scopes;
};

export const resolvePatientNameFromStatusSelect = (select: HTMLSelectElement): string | null => {
  const scopes = collectCandidateScopes(select);

  for (const scope of scopes) {
    const fromElements = readFromElements(scope);
    if (fromElements) {
      return fromElements;
    }

    const fromText = readFromScopeText(scope);
    if (fromText) {
      return fromText;
    }
  }

  return null;
};
