// Cache com o SQLite nativo do Node (sem dependência nativa para compilar).
// - mensagens: retomar uma execução interrompida sem gerar (nem pagar) de novo
// - geocoding: não consultar o Nominatim repetidamente pela mesma cidade
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { type Outreach, OutreachSchema } from './llm/schema.ts';

export interface GeocodeEntry {
  latitude: number;
  longitude: number;
  label: string;
}

export interface Cache {
  get(placeId: string, generatorId: string): Outreach | undefined;
  set(placeId: string, generatorId: string, value: Outreach): void;
  getGeocode(query: string): GeocodeEntry | undefined;
  setGeocode(query: string, value: GeocodeEntry): void;
  close(): void;
}

export function openCache(path: string): Cache {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      place_id     TEXT NOT NULL,
      generator_id TEXT NOT NULL,
      payload      TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (place_id, generator_id)
    );
    CREATE TABLE IF NOT EXISTS geocode (
      query      TEXT PRIMARY KEY,
      payload    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const selectMsg = db.prepare('SELECT payload FROM messages WHERE place_id = ? AND generator_id = ?');
  const upsertMsg = db.prepare(
    'INSERT INTO messages (place_id, generator_id, payload) VALUES (?, ?, ?) ' +
      "ON CONFLICT (place_id, generator_id) DO UPDATE SET payload = excluded.payload, created_at = datetime('now')",
  );
  const selectGeo = db.prepare('SELECT payload FROM geocode WHERE query = ?');
  const upsertGeo = db.prepare(
    "INSERT INTO geocode (query, payload) VALUES (?, ?) ON CONFLICT (query) DO UPDATE SET payload = excluded.payload, created_at = datetime('now')",
  );
  const normalizeQuery = (q: string) => q.trim().toLowerCase();

  return {
    get(placeId, generatorId) {
      const row = selectMsg.get(placeId, generatorId) as { payload: string } | undefined;
      if (!row) return undefined;
      const parsed = OutreachSchema.safeParse(JSON.parse(row.payload));
      return parsed.success ? parsed.data : undefined;
    },
    set(placeId, generatorId, value) {
      upsertMsg.run(placeId, generatorId, JSON.stringify(value));
    },
    getGeocode(query) {
      const row = selectGeo.get(normalizeQuery(query)) as { payload: string } | undefined;
      return row ? (JSON.parse(row.payload) as GeocodeEntry) : undefined;
    },
    setGeocode(query, value) {
      upsertGeo.run(normalizeQuery(query), JSON.stringify(value));
    },
    close() {
      db.close();
    },
  };
}

/** Cache que não guarda nada (para --sem-cache). */
export const noCache: Cache = {
  get: () => undefined,
  set: () => {},
  getGeocode: () => undefined,
  setGeocode: () => {},
  close: () => {},
};
