"use strict";
(() => {
  // extension/chrome/calendarParser.ts
  var START = "--- Family Event Finder ---";
  var END = "--- End Family Event Finder ---";
  function extractFamilyFinderMetadata(description) {
    const start = description.indexOf(START);
    const finish = description.indexOf(END);
    if (start === -1 || finish === -1 || finish <= start) return {};
    const body = description.slice(start + START.length, finish).trim().split("\n");
    const kv = {};
    for (const line of body) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      kv[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return kv;
  }

  // extension/chrome/popup.ts
  var input = document.querySelector("#input");
  var output = document.querySelector("#output");
  var runBtn = document.querySelector("#run");
  var clearBtn = document.querySelector("#clear");
  runBtn?.addEventListener("click", () => {
    if (!output || !input) return;
    output.textContent = JSON.stringify(extractFamilyFinderMetadata(input.value), null, 2);
  });
  clearBtn?.addEventListener("click", () => {
    if (!input || !output) return;
    input.value = "";
    output.textContent = "{}";
  });
})();
