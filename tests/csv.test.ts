import { describe, expect, it } from 'vitest';
import { escapeCsv, toCsv } from '../src/export/csv.ts';
import { toRow } from '../src/export/rows.ts';
import { makePlace } from './fixtures.ts';

describe('escapeCsv', () => {
  it('envolve em aspas e duplica aspas internas', () => {
    expect(escapeCsv('Bar "do Zé", Ltda')).toBe('"Bar ""do Zé"", Ltda"');
  });

  it('preserva quebras de linha dentro das aspas', () => {
    expect(escapeCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('converte null em vazio e números em texto', () => {
    expect(escapeCsv(null)).toBe('""');
    expect(escapeCsv(4.5)).toBe('"4.5"');
  });

  it('neutraliza fórmulas (CSV injection)', () => {
    expect(escapeCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(escapeCsv('+5579999999999')).toBe('"\'+5579999999999"');
  });
});

describe('toCsv', () => {
  it('começa com BOM, tem cabeçalho e usa CRLF', () => {
    const csv = toCsv([toRow(makePlace(), { assunto: 'Oi', mensagem: 'Mensagem de teste longa o bastante', canal_sugerido: 'visita' })]);
    expect(csv.startsWith('﻿"nome","tipo"')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3); // cabeçalho + 1 linha + final vazio
    expect(csv).toContain('"Bistrô do Acarajé"');
  });

  it('deixa as colunas da mensagem vazias quando a geração falhou', () => {
    const csv = toCsv([toRow(makePlace(), null)]);
    expect(csv.trimEnd().endsWith('"","",""')).toBe(true);
  });
});
