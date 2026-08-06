/**
 * npm run scrape — regenerate data/kb.json from epa.uz.
 *
 * Takes ~10s. Writes only on success; a partial scrape throws instead of
 * overwriting a good catalogue.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { scrapeEpa } from '../lib/scrape';
import type { Kb } from '../lib/types';

const OUT = path.join(process.cwd(), 'data', 'kb.json');

async function previousCount(): Promise<number | null> {
  try {
    const previous = JSON.parse(await readFile(OUT, 'utf8')) as Kb;
    return previous.items?.length ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const before = await previousCount();
  const kb = await scrapeEpa((message) => console.log(message));

  const json = JSON.stringify(kb);
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, json, 'utf8');

  console.log(
    `wrote ${path.relative(process.cwd(), OUT)} — ${(json.length / 1024).toFixed(0)} KB`,
  );
  if (before !== null) {
    const delta = kb.items.length - before;
    console.log(
      `products: ${before} → ${kb.items.length} (${delta >= 0 ? '+' : ''}${delta})`,
    );
    if (kb.items.length < before * 0.8) {
      console.warn(
        'WARNING: the catalogue shrank by more than 20%. Check epa.uz before shipping this.',
      );
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
