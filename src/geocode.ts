// Geocoding gratuito via Nominatim (OpenStreetMap)
// Política de uso: https://operations.osmfoundation.org/policies/nominatim/ (máx. 1 req/s)
import { fetchJson } from './http.ts';
import type { Coordinates } from './types.ts';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export async function geocodeCity(city: string): Promise<Coordinates & { label: string }> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ q: city, format: 'json', limit: '1', 'accept-language': 'pt-BR' }).toString();

  const [result] = await fetchJson<NominatimResult[]>(url.toString());
  if (!result) {
    throw new Error(`Cidade não encontrada: "${city}". Tente incluir o estado, ex.: "Lagarto, SE".`);
  }

  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    label: result.display_name,
  };
}
