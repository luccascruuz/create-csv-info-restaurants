// CSV seguindo a RFC 4180 (aspas escapadas, quebras de linha preservadas) + BOM para o Excel
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { type Cell, COLUMNS, type Row } from './rows.ts';

export function escapeCsv(value: Cell): string {
  let text = value === null ? '' : String(value);
  // Evita "CSV injection": o Excel executaria células iniciadas por = + - @ como fórmula
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(rows: Row[]): string {
  const lines = [
    COLUMNS.map((c) => escapeCsv(c.header)).join(','),
    ...rows.map((row) => COLUMNS.map((c) => escapeCsv(row[c.key])).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export async function writeCsv(filePath: string, rows: Row[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, toCsv(rows), 'utf8');
}
