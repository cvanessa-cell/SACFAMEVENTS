import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CELL = 48;
const MIN_CELL_HITS = 12;

export async function loadVisualTooling() {
  try {
    await import("playwright");
    await import("pixelmatch");
    await import("pngjs");
    return true;
  } catch {
    return false;
  }
}

function clusterDiffRegions(diffData, width, height) {
  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const hot = new Uint8Array(cols * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      let hits = 0;
      const x0 = col * CELL;
      const y0 = row * CELL;
      const x1 = Math.min(x0 + CELL, width);
      const y1 = Math.min(y0 + CELL, height);
      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          const idx = (y * width + x) * 4;
          if (diffData[idx] > 0 || diffData[idx + 1] > 0 || diffData[idx + 2] > 0) hits += 1;
        }
      }
      if (hits >= MIN_CELL_HITS) hot[row * cols + col] = 1;
    }
  }

  const visited = new Uint8Array(cols * rows);
  const regions = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const start = row * cols + col;
      if (!hot[start] || visited[start]) continue;
      const queue = [start];
      visited[start] = 1;
      let minCol = col;
      let maxCol = col;
      let minRow = row;
      let maxRow = row;

      while (queue.length) {
        const cell = queue.pop();
        const c = cell % cols;
        const r = Math.floor(cell / cols);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        const neighbors = [
          [c - 1, r],
          [c + 1, r],
          [c, r - 1],
          [c, r + 1],
        ];
        for (const [nc, nr] of neighbors) {
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const ni = nr * cols + nc;
          if (!hot[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue.push(ni);
        }
      }

      regions.push({
        x: minCol * CELL,
        y: minRow * CELL,
        width: (maxCol - minCol + 1) * CELL,
        height: (maxRow - minRow + 1) * CELL,
      });
    }
  }

  return regions.slice(0, 24);
}

async function describeElement(page, x, y) {
  return page.evaluate(({ px, py }) => {
    const el = document.elementFromPoint(px, py);
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
    const aria = el.getAttribute("aria-label");
    const role = el.getAttribute("role");
    const href = tag === "a" ? el.getAttribute("href") : null;
    const parts = [`<${tag}>`];
    if (role) parts.push(`role=${role}`);
    if (aria) parts.push(`aria-label="${aria}"`);
    if (href) parts.push(`href="${href}"`);
    if (text) parts.push(`"${text}"`);
    return parts.join(" ");
  }, { px: x, py: y });
}

export async function buildRouteComparison({
  leftUrl,
  rightUrl,
  route,
  cacheDir,
}) {
  const hasTools = await loadVisualTooling();
  if (!hasTools) {
    return {
      route,
      error: "Install dev dependencies: playwright, pixelmatch, pngjs. Then run: npx playwright install chromium",
      annotations: [],
    };
  }

  const { chromium } = await import("playwright");
  const pixelmatch = (await import("pixelmatch")).default;
  const { PNG } = await import("pngjs");

  mkdirSync(cacheDir, { recursive: true });
  const slug = route === "/" ? "home" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "route";
  const leftPath = join(cacheDir, `${slug}-left.png`);
  const rightPath = join(cacheDir, `${slug}-right.png`);
  const diffPath = join(cacheDir, `${slug}-diff.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  try {
    const leftFull = `${leftUrl}${route}`;
    const rightFull = `${rightUrl}${route}`;

    await page.goto(leftFull, { waitUntil: "networkidle", timeout: 45_000 }).catch(() =>
      page.goto(leftFull, { waitUntil: "domcontentloaded", timeout: 45_000 }),
    );
    await page.screenshot({ path: leftPath, fullPage: true });

    await page.goto(rightFull, { waitUntil: "networkidle", timeout: 45_000 }).catch(() =>
      page.goto(rightFull, { waitUntil: "domcontentloaded", timeout: 45_000 }),
    );
    await page.screenshot({ path: rightPath, fullPage: true });

    const leftImage = PNG.sync.read(readFileSync(leftPath));
    const rightImage = PNG.sync.read(readFileSync(rightPath));
    const width = Math.max(leftImage.width, rightImage.width);
    const height = Math.max(leftImage.height, rightImage.height);

    const normalize = (image) => {
      if (image.width === width && image.height === height) return image;
      const out = new PNG({ width, height, fill: true });
      PNG.bitblt(image, out, 0, 0, image.width, image.height, 0, 0);
      return out;
    };

    const normalizedLeft = normalize(leftImage);
    const normalizedRight = normalize(rightImage);
    const diff = new PNG({ width, height });
    const mismatchPixels = pixelmatch(
      normalizedLeft.data,
      normalizedRight.data,
      diff.data,
      width,
      height,
      { threshold: 0.12 },
    );
    writeFileSync(diffPath, PNG.sync.write(diff));

    const regions = clusterDiffRegions(diff.data, width, height);
    const annotations = [];

    for (let index = 0; index < regions.length; index += 1) {
      const region = regions[index];
      const cx = Math.min(width - 1, region.x + Math.floor(region.width / 2));
      const cy = Math.min(height - 1, region.y + Math.floor(region.height / 2));

      await page.goto(rightFull, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
      const elementNote = await describeElement(page, cx, cy).catch(() => null);
      const note = elementNote
        ? `Branch UI differs here: ${elementNote}`
        : `Visual change detected in this area (${region.width}×${region.height}px region).`;

      annotations.push({
        index: index + 1,
        ...region,
        note,
      });
    }

    const totalPixels = width * height;
    return {
      route,
      slug,
      leftFile: `${slug}-left.png`,
      rightFile: `${slug}-right.png`,
      mismatchPercentage: totalPixels ? (mismatchPixels / totalPixels) * 100 : 0,
      annotations,
    };
  } finally {
    await browser.close();
  }
}
