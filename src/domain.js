export const SEED_CATEGORIES = [
  { id: 'ceo', name: 'CEO / propietarios', rules: { titles: ['ceo', 'chief executive', 'propietario', 'propietaria', 'dueño', 'fundador', 'presidente'] } },
  { id: 'leadership', name: 'Alta dirección', rules: { titles: ['director general', 'general manager', 'director de planta', 'plant manager', 'vice president', 'vp', 'director'] } },
  { id: 'finance', name: 'Finanzas', rules: { titles: ['cfo', 'finanzas', 'finance', 'contralor', 'controller'] } },
  { id: 'procurement', name: 'Compras', rules: { titles: ['compras', 'procurement', 'purchasing', 'abastecimiento', 'supply chain'] } },
  { id: 'operations', name: 'Operaciones', rules: { titles: ['operaciones', 'operations', 'manufactura', 'manufacturing', 'producción', 'production'] } },
  { id: 'hr', name: 'Recursos humanos', rules: { titles: ['recursos humanos', 'human resources', 'hr director', 'people'] } },
  { id: 'sales', name: 'Ventas', rules: { titles: ['ventas', 'sales', 'comercial'] } },
  { id: 'marketing', name: 'Marketing', rules: { titles: ['marketing', 'mercadotecnia'] } },
  { id: 'technology', name: 'Tecnología', rules: { titles: ['cio', 'cto', 'it director', 'tecnología', 'technology', 'sistemas'] } },
  { id: 'manufacturing', name: 'Manufactura', rules: { industries: ['manufactura', 'manufacturing', 'automotriz', 'automotive', 'industrial'] } },
  { id: 'distribution', name: 'Distribución', rules: { industries: ['distribución', 'distribution', 'logística', 'logistics'] } },
  { id: 'alliance', name: 'Aliados', rules: { tags: ['aliado', 'partner'] } },
  { id: 'customer', name: 'Clientes potenciales', rules: { tags: ['cliente potencial', 'prospecto'] } }
];

export const DEFAULT_ICP = { factors: { title: 30, sector: 25, location: 20, company: 15, keywords: 10 }, criteria: {
  title: ['ceo', 'propietario', 'director general', 'director de planta', 'compras', 'procurement', 'purchasing'],
  sector: ['manufactura', 'manufacturing', 'automotriz', 'automotive', 'industrial'],
  location: ['guanajuato', 'león', 'silao', 'irapuato', 'celaya', 'salamanca', 'apaseo'],
  company: [], keywords: ['manufactura', 'planta', 'proveeduría', 'compras']
}};

export function normalizeText(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function canonicalizeUrl(value = '') {
  try {
    const url = new URL(value.trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|trk|tracking|ref)/i.test(key)) url.searchParams.delete(key);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
}

export function getDomain(value = '') {
  try { return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

export function makeProspect(input = {}) {
  const name = String(input.fullName || input.name || '').trim();
  const profileUrl = canonicalizeUrl(input.profileUrl || input.linkedinUrl || '');
  const companyWebsite = String(input.companyWebsite || input.website || '').trim();
  const capturedAt = input.capturedAt || new Date().toISOString();
  const source = String(input.source || '').trim();
  const evidenceUrl = String(input.evidenceUrl || input.sourceUrl || '').trim();
  const observedValues = { fullName: name, title: input.title || input.role || '', company: input.company || '', industry: input.industry || '', locality: input.locality || input.city || '', state: input.state || '', country: input.country || '', profileUrl, companyWebsite, companySize: input.companySize || '', description: input.description || '', keywords: input.keywords || '', corporateEmail: input.corporateEmail || input.email || '' };
  const observed = input.observed || Object.fromEntries(Object.entries(observedValues).filter(([, value]) => Array.isArray(value) ? value.length : String(value || '').trim()));
  const unknown = input.unknown || Object.entries(observedValues).filter(([, value]) => !(Array.isArray(value) ? value.length : String(value || '').trim())).map(([field]) => field);
  const provenance = { ...(input.fieldProvenance || {}) };
  for (const field of Object.keys(observed)) provenance[field] ||= { source: source || 'Captura/importación del usuario; pendiente de validar', evidenceUrl, capturedAt, verificationStatus: input.verificationStatus || 'pendiente' };
  return {
    fullName: name, normalizedName: normalizeText(name), title: String(input.title || input.role || '').trim(),
    company: String(input.company || '').trim(), industry: String(input.industry || '').trim(),
    locality: String(input.locality || input.city || '').trim(), state: String(input.state || '').trim(), country: String(input.country || '').trim(),
    profileUrl, canonicalProfileUrl: profileUrl, companyWebsite, companyDomain: getDomain(companyWebsite),
    companySize: String(input.companySize || '').trim(), description: String(input.description || '').trim(),
    keywords: Array.isArray(input.keywords) ? input.keywords : String(input.keywords || '').split(/[;,]/).map(x => x.trim()).filter(Boolean),
    corporateEmail: String(input.corporateEmail || input.email || '').trim(), source, evidenceUrl,
    capturedAt, confidence: input.confidence || 'Sin verificar', verificationStatus: input.verificationStatus || 'pendiente',
    notes: String(input.notes || ''), status: input.status || 'nuevo', discoveryStatus: input.discoveryStatus || 'manual', sourceEvidence: Array.isArray(input.sourceEvidence) ? input.sourceEvidence : [], crossSourceCount: Number(input.crossSourceCount || input.sourceEvidence?.length || (evidenceUrl ? 1 : 0)), categoryIds: input.categoryIds || [], tags: input.tags || [], listIds: input.listIds || [], lists: input.lists || [], fieldProvenance: provenance, observed, inferred: input.inferred || {}, unknown
  };
}

const fieldValue = (person, key) => ({ title: person.title, sector: person.industry, location: [person.locality, person.state, person.country].filter(Boolean).join(' '), company: person.company, keywords: [...(person.keywords || []), person.description || ''].join(' ') })[key] || '';

export function scoreProspect(person, icp = DEFAULT_ICP) {
  const factors = icp.factors || DEFAULT_ICP.factors;
  const criteria = icp.criteria || DEFAULT_ICP.criteria;
  let points = 0, coverage = 0;
  const details = {};
  for (const key of ['title', 'sector', 'location', 'company', 'keywords']) {
    const weight = Number(factors[key] || 0);
    const value = fieldValue(person, key);
    const present = Boolean(String(value).trim());
    const terms = criteria[key] || [];
    const hits = present ? terms.filter(term => normalizeText(value).includes(normalizeText(term))) : [];
    if (present) coverage += weight;
    if (present && hits.length) points += weight;
    details[key] = { weight, present, matched: hits.length > 0, matchedTerms: hits, evidence: present ? String(value) : 'Desconocido' };
  }
  return { score: Math.round(points), coverage: Math.round(coverage), points, details, explanation: Object.entries(details).map(([key, d]) => `${key}: ${d.present ? (d.matched ? `coincide (${d.matchedTerms.join(', ')})` : 'sin coincidencia') : 'dato ausente'} (${d.weight} puntos)`) };
}

function matchesRule(value, terms = []) {
  const normalized = normalizeText(value);
  return terms.filter(term => normalized.includes(normalizeText(term)));
}

export function classifyProspect(person, categories = SEED_CATEGORIES) {
  const results = [];
  for (const category of categories) {
    const rules = category.rules || {};
    const positives = [
      ...matchesRule(person.title, rules.titles), ...matchesRule(person.industry, rules.industries),
      ...matchesRule(person.locality, rules.locations), ...matchesRule(person.company, rules.companies),
      ...matchesRule([...(person.tags || []), ...(person.keywords || [])].join(' '), rules.tags)
    ];
    const negatives = matchesRule([person.title, person.industry, person.locality, person.company].join(' '), rules.exclude || []);
    if (positives.length && !negatives.length) results.push({ id: category.id, name: category.name, explanation: `Coincide con: ${[...new Set(positives)].join(', ')}` });
  }
  return results;
}

export function findDuplicates(candidate, existing = []) {
  const shaped = candidate.normalizedName ? candidate : makeProspect(candidate);
  const profile = shaped.canonicalProfileUrl || canonicalizeUrl(shaped.profileUrl || '');
  const domain = shaped.companyDomain || getDomain(shaped.companyWebsite || '');
  const name = shaped.normalizedName || normalizeText(shaped.fullName || '');
  const exact = [], probable = [];
  for (const item of existing) {
    const itemUrl = item.canonicalProfileUrl || canonicalizeUrl(item.profileUrl || '');
    if (profile && itemUrl && profile === itemUrl) { exact.push(item); continue; }
    const itemName = item.normalizedName || normalizeText(item.fullName || '');
    const itemDomain = item.companyDomain || getDomain(item.companyWebsite || '');
    if (name && itemName && name === itemName && domain && domain === itemDomain) { exact.push(item); continue; }
    const company = normalizeText(shaped.company || '');
    const itemCompany = normalizeText(item.company || '');
    if (name && itemName && name === itemName && company && itemCompany && company === itemCompany) { exact.push(item); continue; }
    if (name && itemName && jaccard(name, itemName) >= 0.82 && (!domain || !itemDomain || domain === itemDomain)) probable.push(item);
  }
  return { exact, probable };
}

function jaccard(a, b) {
  const aa = new Set(normalizeText(a).split(' ').filter(Boolean));
  const bb = new Set(normalizeText(b).split(' ').filter(Boolean));
  const intersection = [...aa].filter(x => bb.has(x)).length;
  return intersection / Math.max(1, new Set([...aa, ...bb]).size);
}

export function validateWeights(factors) {
  const total = Object.values(factors).reduce((sum, x) => sum + Number(x || 0), 0);
  return { valid: total === 100, total };
}
