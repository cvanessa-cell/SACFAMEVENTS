import { prisma } from "@/lib/prisma";

const RESPONSE_IDS = [
  "resp_0773e92b9b572e540069ff02aa68948197b9199eaa64b798f3",
  "resp_01c3b2c207109a160069ff02a90630819dbfd10a4aac764475",
  "resp_078f6aa9d5a9af9c0069ff02a3a3f481979d437c4efee480b3",
  "resp_0509c2ca4738289c0069ff02a781348195ab584119cb966e0d",
  "resp_0fe5e4ae2917f7450069ff02a5fcb48193ab2657085d6b0661",
  "resp_0b8fe2bac8f0c8650069ff02a1bbec819e8720dbf0dd8901b2",
];

async function main() {
  for (const responseId of RESPONSE_IDS) {
    const job = await prisma.aiEventExtractionJob.findUnique({
      where: { openaiResponseId: responseId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        sourceChangeId: true,
        sourceChange: { select: { status: true, source: { select: { name: true, sourceUrl: true } } } },
      },
    });
    console.log(JSON.stringify({ responseId, job }, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
