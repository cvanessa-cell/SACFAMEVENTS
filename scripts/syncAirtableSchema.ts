import "dotenv/config";

async function main() {
  console.log(
    `Hit Airtable Meta API manually for base ${process.env.AIRTABLE_BASE_ID ?? "(unset)"}`,
  );
  console.log(
    "Document field IDs in docs/AIRTABLE_SCHEMA.md whenever schema changes drift.",
  );
}

void main();
