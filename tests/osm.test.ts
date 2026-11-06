import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildQuery, distanceMeters, normalizeElement, type OsmElement, searchOsm } from '../src/sources/osm.ts';

const origin = { latitude: -10.9172, longitude: -37.65 };
const search = { ...origin, radius: 5000, limit: 2, query: '' };

describe('distanceMeters', () => {
  it('é zero no mesmo ponto e ~111 km por grau de latitude', () => {
    expect(distanceMeters(origin, origin)).toBe(0);
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111_195, -2);
  });
});

describe('buildQuery', () => {
  it('monta a query Overpass com tipos, raio e centro', () => {
    expect(buildQuery(search, ['restaurant', 'cafe'])).toContain('["amenity"~"^(restaurant|cafe)$"]["name"](around:5000,-10.9172,-37.65)');
  });
});

describe('normalizeElement', () => {
  it('ignora elementos sem nome', () => {
    expect(normalizeElement({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'restaurant' } }, origin)).toBeNull();
  });

  it('normaliza tags do OSM, traduz culinária e usa o centro de "ways"', () => {
    const place = normalizeElement(
      {
        type: 'way',
        id: 42,
        center: { lat: -10.918, lon: -37.651 },
        tags: {
          name: 'Pizzaria Bella',
          amenity: 'fast_food',
          cuisine: 'pizza;italian;unknown_value',
          'addr:street': 'Rua A',
          'addr:housenumber': '10',
          'addr:city': 'Lagarto',
          'contact:phone': '+55 79 99999-0000',
          'contact:instagram': '@pizzariabella',
        },
      },
      origin,
    );

    expect(place).toMatchObject({
      id: 'osm:way/42',
      nome: 'Pizzaria Bella',
      tipo: 'Lanchonete',
      categorias: ['pizzas', 'culinária italiana'],
      endereco: 'Rua A, 10 - Lagarto',
      telefone: '+55 79 99999-0000',
      instagram: 'https://instagram.com/pizzariabella',
      site: null,
      linkMapa: 'https://www.openstreetmap.org/way/42',
    });
    expect(place?.distanciaM).toBeGreaterThan(0);
  });
});

describe('searchOsm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('filtra, ordena por distância e respeita o limite', async () => {
    const elements: OsmElement[] = [
      { type: 'node', id: 1, lat: -10.95, lon: -37.65, tags: { name: 'Longe', amenity: 'restaurant' } },
      { type: 'node', id: 2, lat: -10.9173, lon: -37.65, tags: { name: 'Perto', amenity: 'restaurant' } },
      { type: 'node', id: 3, lat: -10.92, lon: -37.65, tags: { name: 'Meio', amenity: 'restaurant' } },
      { type: 'node', id: 4, lat: -10.9172, lon: -37.65, tags: { amenity: 'restaurant' } },
    ];
    const fetchMock = vi.fn(async () => Response.json({ elements }));
    vi.stubGlobal('fetch', fetchMock);

    const places = await searchOsm(search, ['restaurant']);

    expect(places.map((p) => p.nome)).toEqual(['Perto', 'Meio']);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
