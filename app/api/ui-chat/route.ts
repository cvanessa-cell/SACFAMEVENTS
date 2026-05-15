import { NextResponse } from "next/server";

import { getOpenAIClient } from "@/lib/openai/client";
import type { UIConfig } from "@/lib/ui-config/schema";

const SYSTEM_PROMPT = `You are a UI design assistant for the "Sacramento Family Event Finder" web application. Your job is to help the user customize the look, feel, and layout of the app.

The app is a Next.js dashboard for discovering family-friendly events in Sacramento. It has:
- An Events page (main listing of upcoming events)
- A Sources page (event data sources)
- A Settings & automation page
- Admin pages: Monitoring, Sources management, Review queue

You can adjust:

1. THEME (colors as HSL values like "221.2 83.2% 53.3%"):
   - mode: "light" or "dark"
   - background, foreground, card, cardForeground
   - primary, primaryForeground (buttons, links, accents)
   - secondary, secondaryForeground
   - muted, mutedForeground (subtle text, backgrounds)
   - accent, accentForeground
   - border, input (field borders), ring (focus outline)
   - radius: border radius like "0.5rem", "0.75rem", "1rem", "1.5rem"
   - fontScale: number between 0.75 and 1.5 (1 = default)

2. LAYOUT:
   - maxWidth: "4xl" | "5xl" | "6xl" | "7xl" | "full"
   - contentDensity: "compact" | "comfortable" | "spacious"
   - cardStyle: "minimal" | "default" | "elevated"
   - gridColumns: 1-4 (columns for event card grids)
   - navPosition: "top" | "sidebar"

3. VISIBILITY:
   - showMapEmbeds: boolean
   - showConfidenceScores: boolean
   - showSourceInfo: boolean
   - showAgeRange: boolean
   - showPricing: boolean
   - navItems: array of {href, label, visible} to reorder or hide nav links

When the user asks for changes, call the update_ui_config function with ONLY the properties that should change. Do not include unchanged properties.

Be creative and helpful. If the user says something vague like "make it more modern" or "warmer colors", interpret that into specific design changes. Explain what you changed and why in your response.`;

const UI_CONFIG_TOOL = {
  type: "function" as const,
  function: {
    name: "update_ui_config",
    description:
      "Update the UI configuration. Only include properties that should change.",
    parameters: {
      type: "object",
      properties: {
        theme: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["light", "dark"] },
            background: { type: "string", description: "HSL value" },
            foreground: { type: "string", description: "HSL value" },
            card: { type: "string", description: "HSL value" },
            cardForeground: { type: "string", description: "HSL value" },
            primary: { type: "string", description: "HSL value" },
            primaryForeground: { type: "string", description: "HSL value" },
            secondary: { type: "string", description: "HSL value" },
            secondaryForeground: { type: "string", description: "HSL value" },
            muted: { type: "string", description: "HSL value" },
            mutedForeground: { type: "string", description: "HSL value" },
            accent: { type: "string", description: "HSL value" },
            accentForeground: { type: "string", description: "HSL value" },
            border: { type: "string", description: "HSL value" },
            input: { type: "string", description: "HSL value" },
            ring: { type: "string", description: "HSL value" },
            radius: { type: "string", description: "e.g. 0.5rem, 1rem" },
            fontScale: { type: "number", minimum: 0.75, maximum: 1.5 },
          },
        },
        layout: {
          type: "object",
          properties: {
            maxWidth: { type: "string", enum: ["4xl", "5xl", "6xl", "7xl", "full"] },
            contentDensity: { type: "string", enum: ["compact", "comfortable", "spacious"] },
            cardStyle: { type: "string", enum: ["minimal", "default", "elevated"] },
            gridColumns: { type: "number", minimum: 1, maximum: 4 },
            navPosition: { type: "string", enum: ["top", "sidebar"] },
          },
        },
        visibility: {
          type: "object",
          properties: {
            showMapEmbeds: { type: "boolean" },
            showConfidenceScores: { type: "boolean" },
            showSourceInfo: { type: "boolean" },
            showAgeRange: { type: "boolean" },
            showPricing: { type: "boolean" },
            navItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  href: { type: "string" },
                  label: { type: "string" },
                  visible: { type: "boolean" },
                },
                required: ["href", "label", "visible"],
              },
            },
          },
        },
      },
    },
  },
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  try {
    const { message, history, currentConfig } = (await request.json()) as {
      message: string;
      history: ChatMessage[];
      currentConfig: UIConfig;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const openai = getOpenAIClient();

    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      {
        role: "system" as const,
        content: `Current UI configuration:\n${JSON.stringify(currentConfig, null, 2)}`,
      },
      ...history.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_UI_CHAT_MODEL || "gpt-4o-mini",
      messages,
      tools: [UI_CONFIG_TOOL],
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    let assistantMessage = choice.message.content || "";
    let configUpdate: Record<string, unknown> | null = null;

    if (choice.message.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      if ("function" in toolCall && toolCall.function.name === "update_ui_config") {
        try {
          configUpdate = JSON.parse(toolCall.function.arguments);
        } catch {
          configUpdate = null;
        }
      }

      if (configUpdate && !assistantMessage) {
        const toolCallId = "id" in toolCall ? toolCall.id : "call_0";
        const followUp = await openai.chat.completions.create({
          model: process.env.OPENAI_UI_CHAT_MODEL || "gpt-4o-mini",
          messages: [
            ...messages,
            choice.message,
            {
              role: "tool" as const,
              tool_call_id: toolCallId,
              content: JSON.stringify({ success: true, applied: configUpdate }),
            },
          ],
        });
        assistantMessage = followUp.choices[0].message.content || "Done! Changes applied.";
      }
    }

    return NextResponse.json({
      message: assistantMessage,
      configUpdate,
    });
  } catch (err) {
    console.error("[ui-chat] Error:", err);
    return NextResponse.json(
      { error: "Failed to process chat message", detail: String(err) },
      { status: 500 },
    );
  }
}
