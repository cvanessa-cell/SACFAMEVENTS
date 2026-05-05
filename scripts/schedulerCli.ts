import "dotenv/config";

async function main() {
  const res = await fetch(
    `${process.env.APP_BASE_URL ?? "http://localhost:3333"}/api/scheduler/run`,
    { method: "POST" },
  );
  console.log(await res.json());
}

void main();
