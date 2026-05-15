export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getOpenAIClient } from "@/lib/openai/client";

/**
 * Accepts a screenshot URL (or base64 data URI) and uses OpenAI Vision
 * to extract event information from the image.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const imageUrl: string | undefined = body.imageUrl;
    const imageBase64: string | undefined = body.imageBase64;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { ok: false, message: "Provide imageUrl or imageBase64" },
        { status: 400 },
      );
    }

    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";

    const imageContent = imageUrl
      ? { type: "image_url" as const, image_url: { url: imageUrl } }
      : {
          type: "image_url" as const,
          image_url: { url: `data:image/png;base64,${imageBase64}` },
        };

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are extracting family-friendly event information from a screenshot image. 
Extract structured event data in JSON format with these fields:
- title: Event name
- description: Brief description
- date: Date in ISO format (YYYY-MM-DD) if visible
- startTime: Start time if visible
- endTime: End time if visible
- venueName: Venue or location name
- address: Full address if visible
- city: City name
- ageRange: Age range if mentioned
- priceText: Cost/price info
- registrationUrl: Registration URL if visible
- confidence: Your confidence in the extraction (0-1)
- rawText: All text you can read from the image

Return a JSON object with an "events" array containing extracted events, and a "rawText" field with all visible text.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all event information from this screenshot:",
            },
            imageContent,
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { rawText: content, events: [] };
    }

    logger.info(
      `Screenshot extraction complete: ${parsed.events?.length ?? 0} events found`,
      "api/screenshot-extract",
    );

    return NextResponse.json({ ok: true, ...parsed });
  } catch (error) {
    logger.error("Screenshot extraction failed", error, "api/screenshot-extract");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
