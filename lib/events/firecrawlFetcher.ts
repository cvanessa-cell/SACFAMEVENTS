/**
 * Firecrawl-backed page fetcher.
 *
 * Used for sources that block direct HTTP requests (Facebook) or require
 * full JS rendering. Firecrawl runs a headless browser, bypasses common
 * anti-bot defenses, and returns clean markdown + raw HTML.
 *
 * Activated by setting FIRECRAWL_API_KEY. Falls through with a clear error
 * message when the key is missing, so operators know what to configure.
 *
 * Docs: https://docs.firecrawl.dev/api-reference/endpoint/scrape
 */

const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/scrape";

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    metadata?: {
      statusCode?: number;
      sourceURL?: string;
      title?: string;
    };
  };
  error?: string;
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

export interface FirecrawlFetchResult {
  text: string;
  status: number;
  title?: string;
  finalUrl?: string;
}

export async function firecrawlFetch(
  url: string,
  options: { timeoutMs?: number; waitForMs?: number } = {},
): Promise<FirecrawlFetchResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not configured. Set it in .env to fetch Facebook / JS-rendered sources. Get a key at https://firecrawl.dev.",
    );
  }

  const { timeoutMs = 45000, waitForMs = 3000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: waitForMs,
      timeout: Math.max(timeoutMs - 2000, 10000),
    };

    const res = await fetch(FIRECRAWL_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as FirecrawlScrapeResponse;

    if (!res.ok || !data.success) {
      const detail = data.error || `HTTP ${res.status}`;
      throw new Error(`Firecrawl scrape failed: ${detail}`);
    }

    const markdown = data.data?.markdown?.trim();
    if (!markdown) {
      throw new Error("Firecrawl returned empty content.");
    }

    return {
      text: markdown,
      status: data.data?.metadata?.statusCode ?? 200,
      title: data.data?.metadata?.title,
      finalUrl: data.data?.metadata?.sourceURL,
    };
  } finally {
    clearTimeout(timer);
  }
}
