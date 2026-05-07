import "dotenv/config";

import { assertGoogleConfigured } from "../lib/googleCalendar";

async function main() {
  await assertGoogleConfigured();
  console.log(
    "Google env vars detected. Calendar insert smoke test executes after OAuth wiring.",
  );
}

void main();
