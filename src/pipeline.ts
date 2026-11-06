import pLimit from 'p-limit';
import type { Cache } from './cache.ts';
import { writeCsv } from './export/csv.ts';
import { type Row, toRow } from './export/rows.ts';
import { writeXlsx } from './export/xlsx.ts';
import type { MessageGenerator } from './llm/index.ts';
import type { Outreach } from './llm/schema.ts';
import type { Place } from './types.ts';

export interface GenerateResult {
  rows: Row[];
  generated: number;
  cached: number;
  failed: number;
}

export async function generateRows(
  places: Place[],
  generator: MessageGenerator,
  cache: Cache,
  concurrency: number,
): Promise<GenerateResult> {
  const limit = pLimit(concurrency);
  const stats = { generated: 0, cached: 0, failed: 0 };
  const total = places.length;
  let done = 0;

  const rows = await Promise.all(
    places.map((place) =>
      limit(async () => {
        let outreach: Outreach | null = cache.get(place.id, generator.id) ?? null;
        let status = '↺ (cache)';

        if (outreach) {
          stats.cached++;
        } else {
          try {
            outreach = await generator.generate(place);
            cache.set(place.id, generator.id, outreach);
            stats.generated++;
            status = '✔';
          } catch (err) {
            stats.failed++;
            status = `✘ ${err instanceof Error ? err.message : String(err)}`;
          }
        }

        done++;
        console.log(`[${String(done).padStart(String(total).length)}/${total}] ${place.nome} ${status}`);
        return toRow(place, outreach);
      }),
    ),
  );

  return { rows, ...stats };
}

export async function exportRows(rows: Row[], output: string, format: 'csv' | 'xlsx' | 'ambos'): Promise<string[]> {
  const base = output.replace(/\.(csv|xlsx)$/i, '');
  const files: string[] = [];
  if (format === 'csv' || format === 'ambos') {
    await writeCsv(`${base}.csv`, rows);
    files.push(`${base}.csv`);
  }
  if (format === 'xlsx' || format === 'ambos') {
    await writeXlsx(`${base}.xlsx`, rows);
    files.push(`${base}.xlsx`);
  }
  return files;
}
