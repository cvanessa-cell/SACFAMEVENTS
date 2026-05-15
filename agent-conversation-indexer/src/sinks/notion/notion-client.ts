import type { IndexerConfig } from "../../config";

const NOTION = "https://api.notion.com/v1";

export async function notionCreatePage(opts: {
  cfg: IndexerConfig;
  title: string;
  markdownBody: string;
}): Promise<{ id: string; url: string } | null> {
  const key = opts.cfg.notionApiKey ?? "";
  const parent = opts.cfg.notionParentPageId ?? "";

  /** Split coarse blocks — minimal rich_text */
  const lines = opts.markdownBody.split("\n").slice(0, 90);
  const children = lines.map((line) => ({
    object: "block",
    paragraph: {
      rich_text: [{ type: "text", text: { content: line.slice(0, 1900) } }],
    },
  }));

  const res = await fetch(`${NOTION}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { page_id: parent },
      properties: {
        title: {
          title: [{ type: "text", text: { content: opts.title.slice(0, 190) } }],
        },
      },
      children,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion create page failed ${res.status}: ${text.slice(0, 500)}`);
  }

  const j = (await res.json()) as { id?: string };
  if (!j.id) return null;
  const url = `https://notion.so/${j.id.replace(/-/g, "")}`;
  return { id: j.id, url };
}
