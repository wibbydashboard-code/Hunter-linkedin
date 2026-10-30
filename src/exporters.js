import ExcelJS from 'exceljs';

export const EXPORT_FIELDS = [
  ['Nombre', 'fullName'], ['Cargo', 'title'], ['Empresa', 'company'], ['Sector', 'industry'], ['Localidad', 'locality'], ['Estado', 'state'], ['País', 'country'],
  ['Perfil profesional', 'profileUrl'], ['Web corporativa', 'companyWebsite'], ['Tamaño empresa', 'companySize'], ['Clasificación', 'categoryNames'], ['Scoring ICP', 'score'], ['Cobertura scoring', 'coverage'],
  ['Estado CRM', 'status'], ['Fuente', 'source'], ['Evidencia URL', 'evidenceUrl'], ['Fecha de captura', 'capturedAt'], ['Verificación', 'verificationStatus'], ['Confianza', 'confidence'], ['Correo corporativo público', 'corporateEmail'], ['Notas', 'notes']
];

export function safeCell(value) {
  let text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  if (/^[\u0000-\u0020]*[=+@-]/.test(text) || /^[\u0000-\u001f]/.test(text)) text = `'${text}`;
  return text;
}

export function toCsv(rows) {
  const header = EXPORT_FIELDS.map(([name]) => name);
  const lines = [header, ...rows.map(row => EXPORT_FIELDS.map(([, key]) => safeCell(row[key])))];
  return '\uFEFF' + lines.map(line => line.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

function downloadableRows(rows) {
  return rows.map(row => Object.fromEntries(EXPORT_FIELDS.map(([label, key]) => [label, safeCell(row[key])])));
}

export async function toXlsx(rows, exportedAt = new Date().toISOString()) {
  const workbook = new ExcelJS.Workbook();
  const data = workbook.addWorksheet('Prospectos');
  data.addRow(EXPORT_FIELDS.map(([name]) => name));
  for (const row of rows) data.addRow(EXPORT_FIELDS.map(([, key]) => safeCell(row[key])));
  data.views = [{ state: 'frozen', ySplit: 1 }];
  data.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + EXPORT_FIELDS.length)}1` };
  const metadata = workbook.addWorksheet('Metadatos');
  metadata.addRows([['Metadato', 'Valor'], ['Fecha de exportación', exportedAt], ['Registros exportados', rows.length], ['Origen de datos', 'CRM local Prospect Hunter B2B'], ['Advertencia', 'Los datos no se envían a un servidor de Prospect Hunter']]);
  return workbook.xlsx.writeBuffer();
}

export function toJsonBackup(prospects, metadata = {}) {
  return JSON.stringify({ format: 'prospect-hunter-b2b-backup', version: 1, exportedAt: new Date().toISOString(), metadata, prospects }, null, 2);
}

export async function parseImport(file) {
  const name = file.name.toLowerCase();
  const text = async () => new TextDecoder('utf-8').decode(await file.arrayBuffer());
  if (name.endsWith('.json')) {
    const parsed = JSON.parse(await text());
    const rows = Array.isArray(parsed) ? parsed : parsed.prospects;
    if (!Array.isArray(rows)) throw new Error('JSON no válido: se esperaba una lista de prospectos o un respaldo de Prospect Hunter.');
    return rows.map(normalizeImportRow);
  }
  if (name.endsWith('.csv')) return parseCsv(await text());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('El archivo XLSX no contiene hojas.');
  const headers = sheet.getRow(1).values.slice(1).map(value => String(value ?? '').trim());
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    headers.forEach((header, index) => { if (header) item[header] = row.getCell(index + 1).text || ''; });
    if (Object.values(item).some(value => value !== '')) rows.push(normalizeImportRow(item));
  });
  return rows;
}

function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, '');
  const matrix = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted && char === '"' && input[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(field); field = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field); matrix.push(row); row = []; field = '';
    } else field += char;
  }
  if (field.length || row.length) { row.push(field); matrix.push(row); }
  if (!matrix.length) return [];
  const headers = matrix.shift().map(value => value.trim());
  return matrix.filter(values => values.some(value => value !== '')).map(values => {
    const item = {}; headers.forEach((header, index) => { if (header) item[header] = values[index] || ''; });
    return normalizeImportRow(item);
  });
}

const ALIASES = {
  fullName: ['nombre', 'nombre completo', 'fullname', 'name'], title: ['cargo', 'puesto', 'title', 'role'], company: ['empresa', 'company'],
  industry: ['sector', 'industria', 'industry'], locality: ['localidad', 'ciudad', 'locality', 'city'], state: ['estado', 'state'], country: ['pais', 'country'],
  profileUrl: ['perfil profesional', 'url perfil', 'profileurl', 'linkedin url'], companyWebsite: ['web corporativa', 'sitio web', 'website'],
  companySize: ['tamano empresa', 'tamaño empresa', 'company size'], description: ['descripcion', 'description'], keywords: ['palabras clave', 'keywords'],
  corporateEmail: ['correo corporativo publico', 'correo corporativo', 'email'], source: ['fuente', 'source'], evidenceUrl: ['evidencia url', 'url de evidencia', 'evidenceurl'],
  capturedAt: ['fecha de captura', 'fecha', 'capturedat'], verificationStatus: ['verificacion', 'estado de verificacion'], confidence: ['confianza', 'confidence'], status: ['estado crm'], notes: ['notas', 'notes']
};
const keyNorm = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function normalizeImportRow(row) {
  const output = { ...row };
  for (const [target, aliases] of Object.entries(ALIASES)) {
    const key = Object.keys(row).find(k => aliases.includes(keyNorm(k)));
    if (key !== undefined) output[target] = row[key];
  }
  return output;
}
