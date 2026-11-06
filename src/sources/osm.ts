// Fonte GRATUITA: OpenStreetMap via Overpass API (sem chave, sem cobrança)
// Docs: https://wiki.openstreetmap.org/wiki/Overpass_API
import { fetchJson } from '../http.ts';
import type { Coordinates, Place, SearchOptions } from '../types.ts';

// Servidores públicos (fair use). OVERPASS_URL permite usar uma instância própria.
const PUBLIC_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Lido na hora da busca (e não no import) para respeitar o .env carregado pela CLI
const mirrors = () => (process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : PUBLIC_MIRRORS);

/** Tipos do OSM considerados "restaurante" e seus nomes em português. */
const AMENITY_LABELS: Record<string, string> = {
  restaurant: 'Restaurante',
  fast_food: 'Lanchonete',
  cafe: 'Café',
  bar: 'Bar',
  pub: 'Bar',
  ice_cream: 'Sorveteria',
};

/** Valores comuns da tag "cuisine" do OSM traduzidos (os demais são descartados). */
const CUISINE_LABELS: Record<string, string> = {
  regional: 'culinária regional',
  brazilian: 'culinária brasileira',
  pizza: 'pizzas',
  burger: 'hambúrgueres',
  japanese: 'culinária japonesa',
  sushi: 'culinária japonesa',
  chinese: 'culinária chinesa',
  italian: 'culinária italiana',
  arab: 'culinária árabe',
  mexican: 'culinária mexicana',
  barbecue: 'churrasco',
  steak_house: 'carnes',
  seafood: 'frutos do mar',
  fish: 'peixes',
  chicken: 'frango',
  sandwich: 'lanches',
  coffee_shop: 'cafés',
  ice_cream: 'sorvetes',
  acai: 'açaí',
  cake: 'bolos',
  pastry: 'doces',
  vegetarian: 'pratos vegetarianos',
  vegan: 'pratos veganos',
};

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildQuery({ latitude, longitude, radius }: SearchOptions, amenities: string[]): string {
  const regex = amenities.join('|');
  return `[out:json][timeout:60];nwr["amenity"~"^(${regex})$"]["name"](around:${radius},${latitude},${longitude});out center tags;`;
}

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function formatAddress(tags: Record<string, string>): string {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
  const city = [tags['addr:city'], tags['addr:state']].filter(Boolean).join(' - ');
  return [street, tags['addr:suburb'], city, tags['addr:postcode']].filter(Boolean).join(' - ') || tags['addr:full'] || '';
}

function formatInstagram(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  return `https://instagram.com/${value.replace(/^@/, '')}`;
}

export function normalizeElement(el: OsmElement, origin: Coordinates): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!tags.name) return null;

  const amenity = tags.amenity ?? '';
  const cuisines = [
    ...new Set(
      (tags.cuisine ?? '')
        .split(';')
        .map((c) => CUISINE_LABELS[c.trim().toLowerCase()])
        .filter((c): c is string => Boolean(c)),
    ),
  ];

  return {
    id: `osm:${el.type}/${el.id}`,
    source: 'osm',
    nome: tags.name,
    endereco: formatAddress(tags),
    telefone: tags.phone ?? tags['contact:phone'] ?? tags['contact:whatsapp'] ?? tags.mobile ?? null,
    site: tags.website ?? tags['contact:website'] ?? null,
    instagram: formatInstagram(tags['contact:instagram'] ?? tags.instagram),
    avaliacao: null,
    qtdAvaliacao: null,
    tipo: AMENITY_LABELS[amenity] ?? 'Restaurante',
    categorias: cuisines,
    linkMapa: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    distanciaM: lat !== undefined && lon !== undefined ? distanceMeters(origin, { latitude: lat, longitude: lon }) : null,
  };
}

export async function searchOsm(options: SearchOptions, amenities = ['restaurant']): Promise<Place[]> {
  const body = new URLSearchParams({ data: buildQuery(options, amenities) });

  const urls = mirrors();
  let lastError: unknown;
  for (const mirror of urls) {
    try {
      // Servidores públicos ficam sobrecarregados com frequência (502/504): backoff mais longo
      const data = await fetchJson<{ elements: OsmElement[] }>(mirror, { method: 'POST', body }, { retries: 3, minTimeout: 3_000 });
      return data.elements
        .map((el) => normalizeElement(el, options))
        .filter((p): p is Place => p !== null)
        .sort((a, b) => (a.distanciaM ?? Infinity) - (b.distanciaM ?? Infinity))
        .slice(0, options.limit);
    } catch (err) {
      lastError = err;
      const isLast = mirror === urls.at(-1);
      console.warn(`⚠ Overpass falhou em ${new URL(mirror).host}: ${(err as Error).message}${isLast ? '' : ' (tentando outro servidor)'}`);
    }
  }
  throw lastError;
}
