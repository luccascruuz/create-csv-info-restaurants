// Planilha Excel formatada: cabeçalho fixo, filtros, links clicáveis e quebra de texto
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import ExcelJS from 'exceljs';
import { COLUMNS, type Row } from './rows.ts';

const LINK_COLUMNS = new Set(['site', 'instagram', 'link_mapa']);

export async function writeXlsx(filePath: string, rows: Row[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'create-csv-info-restaurants';
  const sheet = workbook.addWorksheet('Restaurantes', { views: [{ state: 'frozen', ySplit: 1 }] });

  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  for (const row of rows) {
    const added = sheet.addRow(row);
    for (const key of LINK_COLUMNS) {
      const value = row[key as keyof Row];
      if (typeof value === 'string' && value.startsWith('http')) {
        added.getCell(key).value = { text: value, hyperlink: value };
        added.getCell(key).font = { color: { argb: 'FF1155CC' }, underline: true };
      }
    }
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  sheet.getColumn('mensagem').alignment = { wrapText: true, vertical: 'top' };
  sheet.getColumn('endereco').alignment = { wrapText: true, vertical: 'top' };

  await mkdir(dirname(filePath), { recursive: true });
  await workbook.xlsx.writeFile(filePath);
}
