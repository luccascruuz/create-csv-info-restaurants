import type { Place } from '../src/types.ts';

export function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'osm:node/1',
    source: 'osm',
    nome: 'Bistrô do Acarajé',
    endereco: 'Av. Jovino Bpo. da Cruz, 142 - Lagarto - SE',
    telefone: null,
    site: null,
    instagram: null,
    avaliacao: null,
    qtdAvaliacao: null,
    tipo: 'Restaurante',
    categorias: ['culinária regional'],
    linkMapa: 'https://www.openstreetmap.org/node/1',
    distanciaM: 120,
    ...overrides,
  };
}
