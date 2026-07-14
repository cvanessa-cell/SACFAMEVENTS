const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session");

const subtitle = document.getElementById("compare-subtitle");
const routeTabs = document.getElementById("route-tabs");
const leftTitle = document.getElementById("left-title");
const rightTitle = document.getElementById("right-title");
const leftFrame = document.getElementById("left-frame");
const rightFrame = document.getElementById("right-frame");
const notesList = document.getElementById("notes-list");
const mismatchLine = document.getElementById("mismatch-line");
const routeStatus = document.getElementById("route-status");
const closeBtn = document.getElementById("close-btn");

let session = null;

function setLiveFrames(route) {
  leftFrame.src = `${session.left.url}${route}`;
  rightFrame.src = `${session.right.url}${route}`;
}

function renderNotes(annotations) {
  if (!annotations?.length) {
    notesList.innerHTML =
      "<li>No indexed visual differences detected on this route (or analysis still running).</li>";
    return;
  }
  notesList.innerHTML = annotations
    .map((ann) => `<li><strong>${ann.index}.</strong> ${ann.note}</li>`)
    .join("");
}

async function analyzeRoute(route) {
  const res = await fetch(
    `/api/compare/session/${sessionId}/route?path=${encodeURIComponent(route)}&analyze=1`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Analysis failed");
  if (data.error) {
    notesList.innerHTML = `<li>${data.error}</li>`;
    return;
  }
  renderNotes(data.annotations);
  if (typeof data.mismatchPercentage === "number") {
    mismatchLine.textContent = `${data.mismatchPercentage.toFixed(2)}% visual difference on ${route} (notes from background scan).`;
  }
}

function loadRoute(route) {
  setLiveFrames(route);
  routeStatus.className = "status";
  routeStatus.textContent = `Live apps loaded for ${route}. You can click, scroll, and interact in each pane.`;
  notesList.innerHTML = "<li>Analyzing differences in the background…</li>";
  mismatchLine.textContent = "";

  analyzeRoute(route).catch((error) => {
    notesList.innerHTML = `<li>Could not analyze differences: ${error.message}</li>`;
  });
}

function buildRouteTabs(routes) {
  routeTabs.innerHTML = "";
  for (const route of routes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = route;
    btn.classList.toggle("active", route === routes[0]);
    btn.addEventListener("click", () => {
      routeTabs.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadRoute(route);
    });
    routeTabs.appendChild(btn);
  }
}

closeBtn.addEventListener("click", async () => {
  await fetch(`/api/compare/session/${sessionId}/stop`, { method: "POST" });
  window.close();
});

async function init() {
  if (!sessionId) {
    subtitle.textContent = "Missing session id.";
    return;
  }

  const res = await fetch(`/api/compare/session/${sessionId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Session not found");

  session = data.session;
  subtitle.textContent = `${session.left.label} vs ${session.right.label}`;
  leftTitle.textContent = `${session.left.label} — live`;
  rightTitle.textContent = `${session.right.label} — live`;

  buildRouteTabs(session.routes);
  loadRoute(session.routes[0]);
}

init().catch((error) => {
  subtitle.textContent = error.message;
  routeStatus.className = "status error";
  routeStatus.textContent = error.message;
});
