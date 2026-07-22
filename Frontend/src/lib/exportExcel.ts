import * as XLSX from "xlsx";

type ExportSheet = { name: string; rows: Record<string, unknown>[] };

function cleanCell(value: unknown): string | number | boolean | Date | null {
  if (value == null) return null;
  if (value instanceof Date || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

export function downloadExcel(filename: string, sheets: ExportSheet[]) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const cleaned = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cleanCell(value)])));
    const sheet = XLSX.utils.json_to_sheet(cleaned.length ? cleaned : [{ "No data": "No records available" }]);
    sheet["!cols"] = Object.keys(cleaned[0] ?? { "No data": "" }).map((key) => ({ wch: Math.min(Math.max(key.length + 2, 14), 42) }));
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  });
  XLSX.writeFile(workbook, `${filename.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+$/g, "")}.xlsx`);
}
