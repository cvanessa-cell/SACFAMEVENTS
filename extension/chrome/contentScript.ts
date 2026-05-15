import { extractFamilyFinderMetadata } from "./calendarParser";

const BADGE_CLASS = "ffb-family-badge";
const PANEL_ID = "ffb-family-panel";

function findEventDescriptions(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-eventid] [data-contentel], [data-eventchip] [data-eventchip]',
    ),
  );
}

function findEventDetailPanes(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-eventid], [role="dialog"]',
    ),
  );
}

function getTextContent(el: HTMLElement): string {
  return el.textContent?.trim() ?? "";
}

function createBadge(): HTMLSpanElement {
  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.textContent = "Family Event";
  badge.style.cssText =
    "display:inline-block;background:#3b82f6;color:#fff;font-size:10px;" +
    "padding:1px 6px;border-radius:10px;margin-left:4px;vertical-align:middle;";
  return badge;
}

function createInfoPanel(meta: Record<string, string>): HTMLDivElement {
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText =
    "margin:8px 0;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;" +
    "border-radius:6px;font-size:12px;line-height:1.5;font-family:system-ui,sans-serif;";

  const title = document.createElement("div");
  title.textContent = "Sacramento Family Event Finder";
  title.style.cssText = "font-weight:600;margin-bottom:4px;color:#1e40af;";
  panel.appendChild(title);

  const entries = Object.entries(meta);
  for (const [key, value] of entries) {
    if (!value) continue;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:4px;";
    const label = document.createElement("span");
    label.textContent = `${key}:`;
    label.style.cssText = "color:#6b7280;flex-shrink:0;";
    const val = document.createElement("span");
    val.textContent = value;
    row.appendChild(label);
    row.appendChild(val);
    panel.appendChild(row);
  }

  return panel;
}

function processEventElements() {
  const panes = findEventDetailPanes();

  for (const pane of panes) {
    if (pane.querySelector(`.${BADGE_CLASS}`)) continue;

    const text = getTextContent(pane);
    const meta = extractFamilyFinderMetadata(text);
    const keys = Object.keys(meta);
    if (keys.length === 0) continue;

    const titleEl = pane.querySelector(
      '[data-eventid] span, [role="heading"]',
    );
    if (titleEl && !titleEl.querySelector(`.${BADGE_CLASS}`)) {
      titleEl.appendChild(createBadge());
    }

    const descriptionEl = pane.querySelector(
      '[data-contentel], [jscontroller] [dir]',
    );
    if (descriptionEl && !pane.querySelector(`#${PANEL_ID}`)) {
      descriptionEl.parentElement?.insertBefore(
        createInfoPanel(meta),
        descriptionEl.nextSibling,
      );
    }
  }
}

let observer: MutationObserver | null = null;

function startObserving() {
  if (observer) return;

  processEventElements();

  observer = new MutationObserver(() => {
    processEventElements();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "complete") {
  startObserving();
} else {
  window.addEventListener("load", startObserving);
}

console.debug("[FFB] Sacramento Family Finder content script active");
