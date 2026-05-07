import OpenAI from "openai";

let instance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is required.");
  }
  if (!instance) {
    instance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return instance;
}
