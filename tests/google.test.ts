import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundingBox, type GooglePlace, searchGoogle, translateTypes } from '../src/sources/google.ts';
import { distanceMeters } from '../src/sources/osm.ts';

const search = { latitude: -10.9111, longitude: -37.0717, radius: 10_000, limit: 60, query: 'restaurantes' };

describe('boundingBox', () => {
  it('envolve o círculo: o centro de cada lado fica a ~1 raio do centro', () => {
    const { low, high } = boundingBox(search);
    expect(distanceMeters(search, { latitude: high.latitude, longitude: search.longitude })).toBeCloseTo(10_000, -2);
    expect(distanceMeters(search, { latitude: search.latitude, longitude: low.longitude })).toBeCloseTo(10_000, -2);
  });
});

describe('searchGoogle', () => {
  afterEach(() => vi.unstubAllGlobals());

  const place = (id: string, latitude: number): GooglePlace => ({
    id,
    displayName: { text: id },
    location: { latitude, longitude: search.longitude },
    rating: 4.5,
    userRatingCount: 10,
  });

  it('restringe por retângulo, descarta fora do raio e pagina', async () => {
    const pages = [
      { places: [place('perto', -10.912), place('fora', -11.05)], nextPageToken: 'p2' },
      { places: [place('perto2', -10.92)] },
    ];
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return Response.json(pages.shift());
      }),
    );

    const places = await searchGoogle(search, 'fake-key');

    expect(places.map((p) => p.nome)).toEqual(['perto', 'perto2']);
    expect(bodies[0]).toHaveProperty('locationRestriction.rectangle');
    expect(bodies[0]).not.toHaveProperty('locationBias');
    expect(bodies[1]).toHaveProperty('pageToken', 'p2');
  });
});

describe('translateTypes', () => {
  it('traduz tipos do Google e descarta genéricos/desconhecidos', () => {
    expect(
      translateTypes(['brazilian_restaurant', 'restaurant', 'food', 'point_of_interest', 'sushi_restaurant', 'japanese_restaurant']),
    ).toEqual(['culinária brasileira', 'culinária japonesa']);
    expect(translateTypes(undefined)).toEqual([]);
  });
});
