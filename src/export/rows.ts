import type { Outreach } from '../llm/schema.ts';
import type { Place } from '../types.ts';

export type Cell = string | number | null;

/** Colunas da planilha final, na ordem em que aparecem. */
export const COLUMNS = [
  { key: 'nome', header: 'nome', width: 30 },
  { key: 'tipo', header: 'tipo', width: 16 },
  { key: 'endereco', header: 'endereco', width: 45 },
  { key: 'telefone', header: 'telefone', width: 18 },
  { key: 'site', header: 'site', width: 30 },
  { key: 'instagram', header: 'instagram', width: 30 },
  { key: 'avaliacao', header: 'avaliacao', width: 10 },
  { key: 'qtd_avaliacao', header: 'qtd_avaliacao', width: 13 },
  { key: 'distancia_m', header: 'distancia_m', width: 12 },
  { key: 'link_mapa', header: 'link_mapa', width: 40 },
  { key: 'canal_sugerido', header: 'canal_sugerido', width: 15 },
  { key: 'assunto', header: 'assunto', width: 40 },
  { key: 'mensagem', header: 'mensagem', width: 90 },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]['key'];
export type Row = Record<ColumnKey, Cell>;

export function toRow(place: Place, outreach: Outreach | null): Row {
  return {
    nome: place.nome,
    tipo: place.tipo,
    endereco: place.endereco,
    telefone: place.telefone,
    site: place.site,
    instagram: place.instagram,
    avaliacao: place.avaliacao,
    qtd_avaliacao: place.qtdAvaliacao,
    distancia_m: place.distanciaM,
    link_mapa: place.linkMapa,
    canal_sugerido: outreach?.canal_sugerido ?? null,
    assunto: outreach?.assunto ?? null,
    mensagem: outreach?.mensagem ?? null,
  };
}
