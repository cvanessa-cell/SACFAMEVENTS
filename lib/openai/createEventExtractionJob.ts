import { zodTextFormat } from "openai/helpers/zod";

import { eventExtractionSchema } from "@/lib/events/eventExtractionSchema";
import { getOpenAIClient } from "@/lib/openai/client";
import { prisma } from "@/lib/prisma";

const extractionPrompt = `You are analyzing changed content from a public family-event source in the Sacramento / Placer region. Extract only real events that are kid-friendly or family-friendly. Return structured JSON matching the provided schema. Do not invent missing details. Use America/Los_Angeles timezone. Mark uncertain fields null and set needs_human_review=true. Detect new events, updated events, cancelled events, duplicates, and irrelevant/noise content. Always populate every field — when unknown use null for nullable fields, an empty string for source_summary, and empty arrays for the list fields.`;

export async function createEventExtractionJob(input: {
  sourceChangeId: string;
  sourceName: string;
  sourceUrl: string;
  sourceCategory?: string | null;
  changedText: string;
}) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";

  const requestPayload = {
    model,
    background: true,
    sourceChangeId: input.sourceChangeId,
  };

  const response = await client.responses.create({
    model,
    background: true,
    input: [
      {
        role: "system",
        content: extractionPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              source_name: input.sourceName,
              source_url: input.sourceUrl,
              source_category: input.sourceCategory ?? null,
              changed_text: input.changedText.slice(0, 140000),
            }),
          },
        ],
      },
    ],
    text: {
      format: zodTextFormat(eventExtractionSchema, "event_extraction"),
    },
  });

  const job = await prisma.aiEventExtractionJob.create({
    data: {
      sourceChangeId: input.sourceChangeId,
      openaiResponseId: response.id,
      status: "sent",
      requestPayload: JSON.stringify(requestPayload),
    },
  });

  await prisma.sourceChange.update({
    where: { id: input.sourceChangeId },
    data: { status: "sent_to_openai" },
  });

  return job;
}
