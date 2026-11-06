// Fonte PAGA (opcional): Google Places API (New) - Text Search
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
// ⚠️ Os campos telefone/nota/site entram na faixa "Enterprise" de cobrança.
import { fetchJson } from '../http.ts';
import type { Place, SearchOptions } from '../types.ts';
import { distanceMeters } from './osm.ts';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.primaryTypeDisplayName',
  'places.websiteUri',
  'places.googleMapsUri',
  'nextPageToken',
].join(',');

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  primaryTypeDisplayName?: { text: string };
  websiteUri?: string;
  googleMapsUri?: string;
}

interface GoogleResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

/** Tipos do Google traduzidos. Genéricos (restaurant, food...) e desconhecidos são descartados. */
const TYPE_LABELS: Record<string, string> = {
  brazilian_restaurant: 'culinária brasileira',
  japanese_restaurant: 'culinária japonesa',
  sushi_restaurant: 'culinária japonesa',
  ramen_restaurant: 'culinária japonesa',
  chinese_restaurant: 'culinária chinesa',
  italian_restaurant: 'culinária italiana',
  pizza_restaurant: 'pizzas',
  hamburger_restaurant: 'hambúrgueres',
  seafood_restaurant: 'frutos do mar',
  steak_house: 'carnes',
  barbecue_restaurant: 'churrasco',
  mexican_restaurant: 'culinária mexicana',
  middle_eastern_restaurant: 'culinária árabe',
  lebanese_restaurant: 'culinária árabe',
  french_restaurant: 'culinária francesa',
  thai_restaurant: 'culinária tailandesa',
  indian_restaurant: 'culinária indiana',
  vegetarian_restaurant: 'pratos vegetarianos',
  vegan_restaurant: 'pratos veganos',
  fast_food_restaurant: 'lanches',
  sandwich_shop: 'lanches',
  breakfast_restaurant: 'café da manhã',
  brunch_restaurant: 'brunch',
  buffet_restaurant: 'buffet',
  fine_dining_restaurant: 'alta gastronomia',
  cafe: 'cafés',
  coffee_shop: 'cafés',
  bakery: 'pães e doces',
  dessert_shop: 'sobremesas',
  ice_cream_shop: 'sorvetes',
  acai_shop: 'açaí',
  bar: 'drinks',
};

export function translateTypes(types: string[] = []): string[] {
  return [...new Set(types.map((t) => TYPE_LABELS[t]).filter((t): t is string => Boolean(t)))];
}

export function normalizeGooglePlace(place: GooglePlace, options: SearchOptions): Place {
  return {
    id: `google:${place.id}`,
    source: 'google',
    nome: place.displayName?.text ?? 'SEM NOME',
    endereco: place.formattedAddress ?? '',
    telefone: place.nationalPhoneNumber ?? null,
    site: place.websiteUri ?? null,
    instagram: null,
    avaliacao: place.rating ?? null,
    qtdAvaliacao: place.userRatingCount ?? null,
    tipo: place.primaryTypeDisplayName?.text ?? 'Restaurante',
    categorias: translateTypes(place.types),
    linkMapa: place.googleMapsUri ?? '',
    distanciaM: place.location ? distanceMeters(options, place.location) : null,
  };
}

/**
 * Retângulo que envolve o círculo de busca. O Text Search só aceita restrição por retângulo
 * (`locationBias` com círculo apenas "prefere" a área e traz resultados de fora do raio).
 */
export function boundingBox({ latitude, longitude, radius }: SearchOptions) {
  const dLat = radius / 111_320;
  const dLng = radius / (111_320 * Math.cos((latitude * Math.PI) / 180));
  return {
    low: { latitude: latitude - dLat, longitude: longitude - dLng },
    high: { latitude: latitude + dLat, longitude: longitude + dLng },
  };
}

export async function searchGoogle(options: SearchOptions, apiKey: string): Promise<Place[]> {
  const places: Place[] = [];
  let pageToken: string | undefined;
  const rectangle = boundingBox(options);

  do {
    const data = await fetchJson<GoogleResponse>(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: options.query,
        includedType: 'restaurant',
        languageCode: 'pt-BR',
        regionCode: 'BR',
        pageSize: 20,
        pageToken,
        locationRestriction: { rectangle },
      }),
    });
    // Descarta os cantos do retângulo que ficam fora do círculo
    const inRadius = (data.places ?? [])
      .map((p) => normalizeGooglePlace(p, options))
      .filter((p) => p.distanciaM === null || p.distanciaM <= options.radius);
    places.push(...inRadius);
    pageToken = data.nextPageToken;
  } while (pageToken && places.length < options.limit);

  return places.slice(0, options.limit);
}
