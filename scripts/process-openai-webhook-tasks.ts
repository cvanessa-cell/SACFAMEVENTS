import "dotenv/config";

async function main() {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3333";
  const secret = process.env.CRON_SECRET ?? "";
  const res = await fetch(`${base}/api/cron/process-openai-webhook-tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));
}

void main();
