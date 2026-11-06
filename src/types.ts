export type PlaceSource = 'osm' | 'google';

/** Estabelecimento normalizado, independente da fonte de dados. */
export interface Place {
  /** Identificador único e estável, prefixado pela fonte (ex.: "osm:node/123"). */
  id: string;
  source: PlaceSource;
  nome: string;
  endereco: string;
  telefone: string | null;
  site: string | null;
  instagram: string | null;
  /** Nota 0–5 (só disponível no Google). */
  avaliacao: number | null;
  qtdAvaliacao: number | null;
  /** Tipo principal legível (ex.: "Restaurante", "Pizzaria"). */
  tipo: string;
  /** Categorias / culinárias extras. */
  categorias: string[];
  linkMapa: string;
  distanciaM: number | null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface SearchOptions extends Coordinates {
  radius: number;
  limit: number;
  /** Termo de busca (usado pelo Google) */
  query: string;
}
