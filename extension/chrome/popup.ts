import { extractFamilyFinderMetadata } from "./calendarParser";

const input = document.querySelector<HTMLTextAreaElement>("#input");
const output = document.querySelector<HTMLPreElement>("#output");
const runBtn = document.querySelector<HTMLButtonElement>("#run");
const clearBtn = document.querySelector<HTMLButtonElement>("#clear");

runBtn?.addEventListener("click", () => {
  if (!output || !input) return;
  output.textContent = JSON.stringify(extractFamilyFinderMetadata(input.value), null, 2);
});

clearBtn?.addEventListener("click", () => {
  if (!input || !output) return;
  input.value = "";
  output.textContent = "{}";
});
