const START = "--- Family Event Finder ---";
const END = "--- End Family Event Finder ---";

export function extractFamilyFinderMetadata(description: string) {
  const start = description.indexOf(START);
  const finish = description.indexOf(END);
  if (start === -1 || finish === -1 || finish <= start) return {};
  const body = description
    .slice(start + START.length, finish)
    .trim()
    .split("\n");
  const kv: Record<string, string> = {};
  for (const line of body) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    kv[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return kv;
}
