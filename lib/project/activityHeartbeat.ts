import { prisma } from "@/lib/prisma";

export async function markProjectActivity(): Promise<void> {
  await prisma.slackDecisionState.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      lastHumanActivityAt: new Date(),
    },
    update: {
      lastHumanActivityAt: new Date(),
    },
  });
}
