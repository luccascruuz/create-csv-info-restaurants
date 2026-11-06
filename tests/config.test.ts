import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config.ts';

describe('resolveConfig', () => {
  it('usa padrões gratuitos (osm + auto)', () => {
    const cfg = resolveConfig({ city: 'Lagarto, SE' }, {});
    expect(cfg).toMatchObject({ source: 'osm', provider: 'auto', radius: 10_000, limit: 20, format: 'ambos', cache: true });
    expect(cfg.amenities).toEqual(['restaurant']);
  });

  it('exige cidade ou coordenadas', () => {
    expect(() => resolveConfig({}, {})).toThrow(/--cidade ou --lat e --lng/);
  });

  it('converte números vindos do .env e aplica prioridade CLI > env', () => {
    const cfg = resolveConfig({ limit: '5' }, { SEARCH_LAT: '-10.9', SEARCH_LNG: '-37.6', MAX_RESULTS: '50', SEARCH_RADIUS: '3000' });
    expect(cfg).toMatchObject({ latitude: -10.9, longitude: -37.6, limit: 5, radius: 3000 });
  });

  it('cidade na CLI ignora coordenadas do .env', () => {
    const cfg = resolveConfig({ city: 'Aracaju, SE' }, { SEARCH_LAT: '-10.9', SEARCH_LNG: '-37.6' });
    expect(cfg.latitude).toBeUndefined();
    expect(cfg.city).toBe('Aracaju, SE');
  });

  it('exige chave só para provedores pagos/com conta', () => {
    expect(() => resolveConfig({ city: 'x', source: 'google' }, {})).toThrow(/GOOGLE_MAPS_API_KEY/);
    expect(() => resolveConfig({ city: 'x', provider: 'openai' }, {})).toThrow(/OPENAI_API_KEY/);
    expect(() => resolveConfig({ city: 'x', provider: 'gemini' }, {})).toThrow(/GEMINI_API_KEY/);
    expect(() => resolveConfig({ city: 'x', provider: 'ollama' }, {})).not.toThrow();
  });

  it('rejeita valores inválidos', () => {
    expect(() => resolveConfig({ city: 'x', provider: 'chatgpt' }, {})).toThrow(/Configuração inválida/);
    expect(() => resolveConfig({ city: 'x', radius: 'abc' }, {})).toThrow(/Configuração inválida/);
  });
});

describe('OLLAMA_MODEL', () => {
  it('é lido do .env sem afetar LLM_MODEL', () => {
    const cfg = resolveConfig({ city: 'x' }, { OLLAMA_MODEL: 'gemma3:12b' });
    expect(cfg.ollamaModel).toBe('gemma3:12b');
    expect(cfg.model).toBeUndefined();
  });
});
