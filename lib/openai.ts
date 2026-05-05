/**
 * Thin wrapper around JSON-mode chat completions lands in Milestone 5.
 */
export async function summarizeWithOpenAI(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing.");
  }
  return `[stub completion] ${prompt.slice(0, 48)} …`;
}
