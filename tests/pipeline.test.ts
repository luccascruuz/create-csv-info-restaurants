import { describe, expect, it, vi } from 'vitest';
import { openCache } from '../src/cache.ts';
import type { MessageGenerator } from '../src/llm/index.ts';
import type { Outreach } from '../src/llm/schema.ts';
import { generateRows } from '../src/pipeline.ts';
import { makePlace } from './fixtures.ts';

const outreach: Outreach = { assunto: 'Assunto', mensagem: 'Mensagem gerada pelo teste.', canal_sugerido: 'visita' };

describe('cache', () => {
  it('guarda mensagens por estabelecimento + gerador, e geocoding por cidade', () => {
    const cache = openCache(':memory:');
    cache.set('osm:node/1', 'template:v1', outreach);
    expect(cache.get('osm:node/1', 'template:v1')).toEqual(outreach);
    expect(cache.get('osm:node/1', 'ollama:gemma3')).toBeUndefined();

    cache.setGeocode('Lagarto, SE', { latitude: 1, longitude: 2, label: 'Lagarto' });
    expect(cache.getGeocode('  lagarto, se ')).toEqual({ latitude: 1, longitude: 2, label: 'Lagarto' });
    cache.close();
  });
});

describe('generateRows', () => {
  it('usa o cache, continua após erros e contabiliza tudo', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const cache = openCache(':memory:');
    const places = [makePlace({ id: 'a', nome: 'A' }), makePlace({ id: 'b', nome: 'B' }), makePlace({ id: 'c', nome: 'C' })];
    cache.set('a', 'fake:1', outreach);

    const generate = vi.fn(async (place) => {
      if (place.id === 'c') throw new Error('falhou');
      return { ...outreach, assunto: `novo ${place.nome}` };
    });
    const generator: MessageGenerator = { id: 'fake:1', generate };

    const result = await generateRows(places, generator, cache, 2);

    expect(result).toMatchObject({ generated: 1, cached: 1, failed: 1 });
    expect(generate).toHaveBeenCalledTimes(2); // "a" veio do cache
    expect(result.rows.map((r) => r.assunto)).toEqual(['Assunto', 'novo B', null]); // ordem preservada
    expect(cache.get('b', 'fake:1')?.assunto).toBe('novo B');
    cache.close();
  });
});
