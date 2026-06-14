import { prisma } from "@/lib/prisma";

async function main() {
  const counts = await prisma.openAIWebhookTask.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Status counts:", counts);

  const failed = await prisma.openAIWebhookTask.findMany({
    where: { status: "failed" },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      eventType: true,
      responseId: true,
      errorMessage: true,
      attempts: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log("\nFailed tasks:");
  for (const task of failed) {
    console.log(JSON.stringify(task));
  }

  const pending = await prisma.openAIWebhookTask.count({
    where: { status: "pending" },
  });
  console.log(`\nPending: ${pending}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
