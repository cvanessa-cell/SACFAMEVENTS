/**
 * Reusable panel component for overlaying Family Event Finder metadata
 * on Google Calendar event detail views.
 */

export interface PanelConfig {
  appBaseUrl: string;
}

export function createCalendarPanel(
  meta: Record<string, string>,
  config?: Partial<PanelConfig>,
): HTMLDivElement {
  const baseUrl = config?.appBaseUrl ?? "http://localhost:3333";

  const panel = document.createElement("div");
  panel.className = "ffb-calendar-panel";
  panel.style.cssText =
    "margin:12px 0;padding:12px 16px;background:#f0fdf4;border:1px solid #86efac;" +
    "border-radius:8px;font-size:13px;line-height:1.6;font-family:system-ui,sans-serif;";

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

  const title = document.createElement("span");
  title.textContent = "Family Event Info";
  title.style.cssText = "font-weight:600;color:#166534;";
  header.appendChild(title);

  const link = document.createElement("a");
  link.href = `${baseUrl}/admin/event-review`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open in Admin";
  link.style.cssText = "font-size:11px;color:#3b82f6;text-decoration:underline;";
  header.appendChild(link);

  panel.appendChild(header);

  const fields = [
    { key: "Age Range", icon: "age" },
    { key: "Cost", icon: "cost" },
    { key: "Category", icon: "category" },
    { key: "Venue", icon: "venue" },
    { key: "Source", icon: "source" },
    { key: "Confidence", icon: "confidence" },
  ];

  for (const field of fields) {
    const value = meta[field.key];
    if (!value) continue;
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;padding:2px 0;";
    const label = document.createElement("span");
    label.textContent = `${field.key}:`;
    label.style.cssText = "color:#6b7280;min-width:80px;flex-shrink:0;";
    const val = document.createElement("span");
    val.textContent = value;
    row.appendChild(label);
    row.appendChild(val);
    panel.appendChild(row);
  }

  return panel;
}
