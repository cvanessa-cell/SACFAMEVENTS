/**
 * Capture visible tab screenshot and send to the app's screenshot extraction API.
 * Must be called from the extension popup or background script (not content script).
 */

export interface ScreenshotResult {
  ok: boolean;
  dataUrl?: string;
  error?: string;
}

export async function captureScreenshot(): Promise<ScreenshotResult> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      return { ok: false, error: "No active tab found" };
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: "png",
      quality: 90,
    });

    return { ok: true, dataUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Screenshot capture failed",
    };
  }
}

export async function sendScreenshotToApp(
  dataUrl: string,
  appBaseUrl: string = "http://localhost:3333",
): Promise<{ ok: boolean; events?: unknown[]; rawText?: string; error?: string }> {
  const base64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, "");

  try {
    const res = await fetch(`${appBaseUrl}/api/events/screenshot-extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    return await res.json();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send screenshot",
    };
  }
}
