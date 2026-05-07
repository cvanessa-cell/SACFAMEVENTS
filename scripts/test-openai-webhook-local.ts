import "dotenv/config";

async function main() {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3333";
  const res = await fetch(`${base}/api/webhooks/openai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "response.completed", data: { id: "resp_fake" } }),
  });
  console.log("status", res.status);
  console.log(await res.text());
  console.log("Note: This intentionally fails signature verification unless sent by OpenAI webhook signer.");
}

void main();
