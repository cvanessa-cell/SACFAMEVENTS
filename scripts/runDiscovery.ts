import "dotenv/config";

async function main() {
  const res = await fetch(
    `${process.env.APP_BASE_URL ?? "http://localhost:3333"}/api/events/discover`,
    { method: "POST" },
  );
  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));
}

void main();
