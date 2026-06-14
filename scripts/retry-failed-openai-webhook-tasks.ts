import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { processPendingOpenAIWebhookTasks } from "@/lib/openai/webhookQueue";

async function main() {
  const before = await prisma.openAIWebhookTask.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Before:", before);

  const reset = await prisma.openAIWebhookTask.updateMany({
    where: { status: "failed" },
    data: { status: "pending", errorMessage: null },
  });
  console.log(`Reset ${reset.count} failed task(s) to pending`);

  const results = await processPendingOpenAIWebhookTasks(20);
  console.log("Process results:", JSON.stringify(results, null, 2));

  const after = await prisma.openAIWebhookTask.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("After:", after);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
