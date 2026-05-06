import { prisma } from "@/lib/prisma";
import { processOpenAIWebhookTaskEvent } from "@/lib/openai/webhookProcessor";

export async function enqueueOpenAIWebhookTask(event: { type: string; data?: { id?: string } }) {
  const responseId = event.data?.id;
  if (!responseId) return null;
  return prisma.openAIWebhookTask.create({
    data: {
      eventType: event.type,
      responseId,
      payloadJson: JSON.stringify(event),
      status: "pending",
    },
  });
}

export async function processPendingOpenAIWebhookTasks(batchSize = 20) {
  const tasks = await prisma.openAIWebhookTask.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const results: Array<{ taskId: string; status: string; error?: string }> = [];
  for (const task of tasks) {
    await prisma.openAIWebhookTask.update({
      where: { id: task.id },
      data: { status: "processing", attempts: { increment: 1 } },
    });

    try {
      const event = JSON.parse(task.payloadJson) as { type: string; data?: { id?: string } };
      await processOpenAIWebhookTaskEvent(event);
      await prisma.openAIWebhookTask.update({
        where: { id: task.id },
        data: { status: "completed", processedAt: new Date(), errorMessage: null },
      });
      results.push({ taskId: task.id, status: "completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown queue error";
      await prisma.openAIWebhookTask.update({
        where: { id: task.id },
        data: { status: "failed", errorMessage: message },
      });
      results.push({ taskId: task.id, status: "failed", error: message });
    }
  }

  return results;
}
