export const GUANAJUATO_WP = 'https://boletines.guanajuato.gob.mx';
export const BRAVE_API = 'https://api.search.brave.com/res/v1/web/search';

export const SOURCE_STATUS = [
  { id: 'guanajuato-public', name: 'Boletines oficiales de Guanajuato (WordPress REST)', state: 'público · sin clave', detail: 'Búsqueda del API REST público y lectura limitada de artículos oficiales para extraer cargos y nombres mencionados. Respeta respuestas y bloqueos del sitio.' },
  { id: 'brave', name: 'Brave Search API', state: 'requiere clave', detail: 'Índice web oficial mediante API. La página de Brave indica $5 USD por 1.000 consultas y $5 de crédito mensual; requiere cuenta y clave.' },
  { id: 'linkedin-index', name: 'Perfiles públicos de LinkedIn indexados', state: 'vía Brave · índice únicamente', detail: 'Añade site:linkedin.com/in a la búsqueda de Brave y usa solo título/snippet del índice. No abre LinkedIn, inicia sesión ni consulta perfiles protegidos.' },
  { id: 'brave-approved-pages', name: 'Páginas corporativas y directorios permitidos', state: 'Brave + permiso por host + consentimiento', detail: 'Busca URLs con Brave y extrae texto/JSON-LD solo de HTTPS en hosts exactos que autoriza el usuario. Comprueba robots.txt, tamaño máximo, Content-Type y redirecciones.' },
  { id: 'csv-xlsx', name: 'CSV / XLSX / JSON', state: 'funcional', detail: 'Importación local de archivos legítimos; deduplicación revisable.' }
];

const TITLE_WORDS = /(?:Gerente|Director(?:a)?|Vicepresidente(?:a)?|Presidente|Cofundador(?:a)?|CEO|Chief Executive Officer|Chief Operating Officer|Plant Manager|General Manager|Managing Director|Executive Vice President|VP|Head of|Jefe(?:a)?|Responsable|L[ií]der|Coordinador(?:a)?|Manager|Operations Manager|Production Manager|Purchasing Manager|Procurement Manager)/i;
const COMPANY_ALIASES = [
  ['Martinrea International','Martinrea'],['Martinrea Metálicos','Martinrea'],['Martinrea Planta','Martinrea'],['Martinrea','Martinrea'],
  ['General Motors','General Motors'],['GM de México','General Motors de México'],['Honda de México','Honda de México'],['Honda','Honda'],
  ['Toyota Motor Manufacturing de Guanajuato','Toyota Motor Manufacturing de Guanajuato'],['Toyota Guanajuato','Toyota Motor Manufacturing de Guanajuato'],['Toyota','Toyota'],
  ['Pirelli México','Pirelli México'],['Pirelli','Pirelli'],['Mazda de México','Mazda de México'],['Mazda','Mazda'],
  ['Dauch Corporation','Dauch Corporation'],['American Axle','Dauch Corporation'],['AAM','Dauch Corporation'],
  ['Ferrero','Ferrero'],['Mabe','Mabe'],['Schaeffler','Schaeffler'],['Michelin','Michelin'],['TYW Manufacturing','TYW Manufacturing'],['HENN','HENN']
];
const TOWNS = ['San José Iturbide','Apaseo el Grande','Puerto Interior','Salamanca','Irapuato','Celaya','Silao','León','Apaseo','Guanajuato'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function cleanHtml(html='') {
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\s+/g,' ').trim();
}
export function parseJsonLdPeople(html='') {
  const people=[];const scripts=String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const visit=(node,depth=0)=>{if(depth>12||!node)return;if(Array.isArray(node)){for(const item of node)visit(item,depth+1);return;}if(typeof node!=='object')return;const type=Array.isArray(node['@type'])?node['@type']:[node['@type']];if(type.includes('Person'))people.push(node);for(const value of Object.values(node))if(value&&typeof value==='object')visit(value,depth+1);};
  for(const match of scripts){try{visit(JSON.parse(match[1]));}catch{}}
  return people.map(person=>{const employer=typeof person.worksFor==='string'?person.worksFor:person.worksFor?.name||'';const address=person.address||{};const sameAs=Array.isArray(person.sameAs)?person.sameAs:[person.sameAs];const profileUrl=sameAs.find(value=>{try{const u=new URL(value);return /(^|\.)linkedin\.com$/i.test(u.hostname)&&/^\/in\//.test(u.pathname)}catch{return false}})||'';return {fullName:String(person.name||'').trim(),title:String(person.jobTitle||'').trim(),company:String(employer).trim(),locality:String(address.addressLocality||'').trim(),state:String(address.addressRegion||'').trim(),country:String(address.addressCountry?.name||address.addressCountry||'').trim(),profileUrl};}).filter(person=>person.fullName&&person.title);
}
export function robotsAllows(robotsText, targetUrl) {
  const parsed=new URL(targetUrl);const path=parsed.pathname+parsed.search;const groups=[];let agents=[],rules=[],hasRule=false;
  const flush=()=>{if(agents.length)groups.push({agents:[...agents],rules:[...rules]});agents=[];rules=[];hasRule=false;};
  for(const raw of String(robotsText||'').split(/\r?\n/)){const line=raw.split('#')[0].trim();const i=line.indexOf(':');if(!line||i<0)continue;const key=line.slice(0,i).trim().toLowerCase(),value=line.slice(i+1).trim();if(key==='user-agent'){if(hasRule)flush();agents.push(value.toLowerCase());}else if((key==='allow'||key==='disallow')&&agents.length){hasRule=true;if(value)rules.push({allow:key==='allow',path:value});}}
  flush();const matched=groups.filter(g=>g.agents.includes('*')).flatMap(g=>g.rules).filter(rule=>path.startsWith(rule.path));if(!matched.length)return true;matched.sort((a,b)=>b.path.length-a.path.length||(a.allow===b.allow?0:a.allow?-1:1));return matched[0].allow;
}
export async function fetchApprovedPublicPage(rawUrl,{approvedDomains=[],maxBytes=1_000_000,signal,onRequest}={}) {
  let url;try{url=new URL(rawUrl);}catch{throw new Error('URL pública no válida.');}
  const host=url.hostname.toLowerCase(),allowed=new Set(approvedDomains.map(x=>String(x).toLowerCase()));
  if(url.protocol!=='https:'||!allowed.has(host)||url.username||url.password||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.includes(':'))throw new Error('La página debe ser HTTPS y pertenecer a un host exacto aprobado; hosts locales no permitidos.');
  if(globalThis.chrome?.permissions&&!(await chrome.permissions.contains({origins:[`https://${host}/*`]})))throw new Error(`Falta habilitar el permiso opcional del host ${host}.`);
  const robotsUrl=new URL('/robots.txt',url.origin);onRequest?.({url:robotsUrl.href,kind:'robots'});
  const robotsResponse=await fetch(robotsUrl.href,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal});let robotsText='';if(robotsResponse.status===404)robotsText='';else if(!robotsResponse.ok)throw new Error(`robots.txt devolvió HTTP ${robotsResponse.status}; la página se omite.`);else robotsText=await robotsResponse.text();
  if(!robotsAllows(robotsText,url.href))throw new Error('robots.txt prohíbe consultar esta ruta; el adaptador no intenta eludirlo.');
  onRequest?.({url:url.href,kind:'page'});const response=await fetch(url.href,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal,headers:{Accept:'text/html,application/xhtml+xml'}});
  if(!response.ok)throw new Error(`HTTP ${response.status} al leer página pública; no se reintenta.`);if(!/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||''))throw new Error('Tipo de contenido no HTML; omitido.');
  const declared=Number(response.headers.get('content-length')||0);if(declared>maxBytes)throw new Error('La página excede el máximo de tamaño configurado.');
  const reader=response.body?.getReader();let html='';if(reader){const decoder=new TextDecoder();while(html.length<maxBytes){const {done,value}=await reader.read();if(done)break;html+=decoder.decode(value,{stream:true});if(html.length>=maxBytes){await reader.cancel();break;}}html+=decoder.decode();}else html=(await response.text()).slice(0,maxBytes);
  const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';const main=html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1]||html;
  return {title:decodeTitle(title),url:url.href,publishedAt:'',content:main,description:cleanHtml(main).slice(0,600),structuredPeople:parseJsonLdPeople(html),source:`Página pública aprobada · ${host}`,providerId:'approved-public-page'};
}
function decodeTitle(value='') { return cleanHtml(value).replace(/\u00a0/g,' ').trim(); }
function validOfficialArticleUrl(raw) {
  try { const u=new URL(raw); return u.protocol==='https:' && u.hostname==='boletines.guanajuato.gob.mx' && !u.pathname.startsWith('/wp-admin/'); } catch { return false; }
}

export async function requestBravePermission() {
  if (!globalThis.chrome?.permissions) return true;
  return chrome.permissions.request({ origins: ['https://api.search.brave.com/*'] });
}
export async function requestGuanajuatoPermission() {
  if (!globalThis.chrome?.permissions) return true;
  return chrome.permissions.request({ origins: ['https://boletines.guanajuato.gob.mx/*'] });
}
export async function requestApprovedDomainPermissions(domains=[]) {
  const origins=[...new Set(domains.map(value=>String(value).trim().toLowerCase()).filter(x=>/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(x)).map(host=>`https://${host}/*`))];
  if(!origins.length)throw new Error('Añade al menos un dominio exacto válido.');
  if(!globalThis.chrome?.permissions)return true;
  return chrome.permissions.request({origins});
}

export async function searchBrave(query, apiKey, count=20, page=0, {signal}={}) {
  if (!apiKey) throw new Error('Brave requiere una clave API configurada. El modo de prueba público no requiere Brave.');
  if (globalThis.chrome?.permissions && !(await chrome.permissions.contains({origins:['https://api.search.brave.com/*']}))) throw new Error('Habilita primero el permiso opcional de Brave Search.');
  const url=new URL(BRAVE_API);url.searchParams.set('q',query);url.searchParams.set('count',String(Math.min(20,Math.max(1,count))));url.searchParams.set('offset',String(Math.min(9,Math.max(0,page))));
  const response=await fetch(url,{headers:{'X-Subscription-Token':apiKey,'Accept':'application/json'},signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok) throw new Error(`Brave Search respondió HTTP ${response.status}. Revisa clave, crédito y cuota.`);
  const data=await response.json();return (data.web?.results||[]).map(r=>({title:r.title||'',url:r.url||'',description:r.description||'',source:'Brave Search API',providerId:'brave',capturedAt:new Date().toISOString()}));
}

function extractCompany(text, hintedCompany='') {
  if (hintedCompany && text.toLowerCase().includes(hintedCompany.toLowerCase())) return hintedCompany;
  const lower=text.toLowerCase();
  for (const [alias,canonical] of COMPANY_ALIASES) if (lower.includes(alias.toLowerCase())) return canonical;
  return '';
}
function extractLocation(text,query='') {
  const q=query.toLowerCase();
  for(const town of TOWNS) if(text.toLowerCase().includes(town.toLowerCase())||q.includes(town.toLowerCase())) return town;
  return /guanajuato/i.test(text+' '+query)?'Guanajuato':'';
}
function isManufacturingContext(text,query) {
  return /manufactur|manufactur|planta|automotriz|industrial|producci[oó]n|operaci[oó]n|estampado|colaboradores/i.test(text+' '+query);
}
function linkedinCandidate(result, query) {
  let url;try{url=new URL(result.url)}catch{return null;}
  if(!/(^|\.)linkedin\.com$/i.test(url.hostname)||!/^\/in\//i.test(url.pathname))return null;
  const title=decodeTitle(result.title).replace(/\s*[|–-]\s*LinkedIn.*$/i,'').trim();
  const parts=title.split(/\s+[|–—]\s+|\s+[-–—]\s+/).map(x=>x.trim()).filter(Boolean);
  const name=parts[0]||'';if(name.length<4||!/[A-ZÁÉÍÓÚÑ]/.test(name))return null;
  const profile=parts.slice(1).join(' · ');
  const roleCompany=profile.match(/^(.*?)\s+(?:at|en|@)\s+(.+)$/i);
  return {fullName:name,title:roleCompany?.[1]||profile,company:roleCompany?.[2]||'',locality:extractLocation(result.description||'',query),state:/guanajuato/i.test(query+' '+result.description)?'Guanajuato':'',country:/m[eé]xico/i.test(query+' '+result.description)?'México':'',profileUrl:url.href,source:'Brave Search API · índice público de LinkedIn',evidenceUrl:result.url,sourceEvidence:[{provider:'brave-index',url:result.url,title:result.title,description:result.description||'',capturedAt:new Date().toISOString()}],discoveryStatus:'descubierto',verificationStatus:'pendiente',confidence:'Pendiente de revisar',notes:'Resultado del índice público del buscador. No se abrió LinkedIn ni se verificó el contenido del perfil.',unknown:['ubicación exacta','vigencia del cargo','correo directo']};
}

export function extractProfessionalCandidates(article, {query='', hintedCompany=''}={}) {
  const text=cleanHtml(article.content||article.description||'');
  const title=decodeTitle(article.title||'');
  const whole=`${title}. ${text}`;
  const company=extractCompany(whole,hintedCompany);
  const locality=extractLocation(whole,query);
  const manufacturing=isManufacturingContext(whole,query);
  const evidence=()=>({provider:article.providerId||'guanajuato-public',url:article.url,title,description:article.description||'',publishedAt:article.publishedAt||'',capturedAt:new Date().toISOString()});
  const found=(article.structuredPeople||[]).filter(person=>person.fullName&&person.title).map(person=>({fullName:person.fullName,title:person.title,company:person.company||company,industry:manufacturing?'Manufactura':'',locality:person.locality||'',state:person.state||'',country:person.country||'',profileUrl:person.profileUrl||'',source:article.source||'Página pública autorizada · JSON-LD Person',evidenceUrl:article.url,sourceEvidence:[evidence()],discoveryStatus:'descubierto',verificationStatus:'pendiente',confidence:'Pendiente de revisar · Schema.org en una fuente',notes:'Datos extraídos de Schema.org Person publicado en la página. El estado del empleo no está verificado de forma independiente.',unknown:['correo directo','teléfono']}));
  if(!manufacturing)return found;
  const roleStart=TITLE_WORDS.source;
  const nameToken=`[A-ZÁÉÍÓÚÑ][\\p{L}]*(?:[.'’\\-][\\p{L}]+)*`;
  const pattern=new RegExp(`(${nameToken}(?:\\s+${nameToken}){1,5})\\s*,\\s*(${roleStart}[^.;\\n]{2,140})`,'gu');
  const seen=new Set(found.map(person=>person.fullName.toLowerCase()));
  for(const match of whole.matchAll(pattern)) {
    const name=match[1].trim().replace(/^(?:La|El)\s+(?:Gobernadora|Gobernador|Secretaria|Secretario)\s+/,'');
    let job=match[2].split(/,\s*(?:explic[oó]|dijo|señal[oó]|indic[oó]|a[nñ]adi[oó]|destac[oó]|expres[oó]|quien|que)(?:\s|,|$)/i)[0].trim();
    job=job.replace(/[“”"']+$/g,'').trim();
    const titleMentionsCompany=COMPANY_ALIASES.some(([alias])=>job.toLowerCase().includes(alias.toLowerCase()));
    const specificCompany=extractCompany(job,hintedCompany);
    const relevant=titleMentionsCompany||specificCompany||/\b(?:planta|plant manager|manufactur|producci[oó]n|operations manager|operations|operaciones)\b/i.test(job);
    if(!relevant||name.split(/\s+/).length<2||name.length>100)continue;
    const dedupe=name.toLowerCase();if(seen.has(dedupe))continue;seen.add(dedupe);
    const employer=specificCompany||company||'';
    const roleLocality=TOWNS.find(town=>town!=='Guanajuato'&&new RegExp(`\\b(?:planta|plant|operaci[oó]n(?:es)?|operations?)\\b[^.;,]{0,70}\\b${town.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(job))||'';
    found.push({fullName:name,title:job,company:employer,industry:'Manufactura',locality:roleLocality,state:roleLocality?'Guanajuato':'',country:'México',profileUrl:'',source:article.source||'Boletines oficiales de Guanajuato · WordPress REST público',evidenceUrl:article.url,sourceEvidence:[evidence()],discoveryStatus:'descubierto',verificationStatus:'pendiente',confidence:'Una fuente pública; falta corroboración independiente',notes:'Extracción automática de una mención profesional en un artículo público. La localidad solo se rellena si el cargo menciona explícitamente una planta/operación; confirmar vigencia antes de usar.',unknown:['perfil profesional','correo directo','teléfono'],fieldProvenance:{fullName:{source:article.source||'WordPress REST público',evidenceUrl:article.url,capturedAt:new Date().toISOString(),verificationStatus:'pendiente'},title:{source:article.source||'WordPress REST público',evidenceUrl:article.url,capturedAt:new Date().toISOString(),verificationStatus:'pendiente'},company:{source:article.source||'WordPress REST público',evidenceUrl:article.url,capturedAt:new Date().toISOString(),verificationStatus:'pendiente'},...(roleLocality?{locality:{source:article.source||'WordPress REST público',evidenceUrl:article.url,capturedAt:new Date().toISOString(),verificationStatus:'pendiente',scope:'cargo asociado explícitamente a la planta indicada'}}:{})}});
  }
  return found;
}

export function crossValidateCandidates(candidates) {
  const groups=new Map();
  for(const candidate of candidates){const key=String(candidate.fullName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(!key)continue;const group=groups.get(key)||[];group.push(candidate);groups.set(key,group);}
  return [...groups.values()].map(group=>{
    const merged={...group[0]};const evidence=[...new Map(group.flatMap(x=>x.sourceEvidence||[]).map(e=>[e.url,e])).values()];
    for(const field of ['title','company','industry','locality','state','country','profileUrl'])if(!merged[field])merged[field]=group.find(x=>x[field])?.[field]||'';
    merged.sourceEvidence=evidence;merged.evidenceUrl=evidence[0]?.url||merged.evidenceUrl;
    const distinctSources=new Set(evidence.map(e=>{try{return new URL(e.url).hostname.replace(/^www\./,'')}catch{return e.provider}}));
    const aligned=group.length>1&&group.every(x=>!x.title||!merged.title||x.title.toLowerCase()===merged.title.toLowerCase())&&group.every(x=>!x.company||!merged.company||x.company.toLowerCase()===merged.company.toLowerCase());
    merged.crossSourceCount=distinctSources.size;
    merged.discoveryStatus='descubierto';merged.verificationStatus=distinctSources.size>=2&&aligned?'verificado por fuentes cruzadas':'pendiente';
    merged.confidence=merged.verificationStatus==='verificado por fuentes cruzadas'?'Alta · fuentes independientes alineadas':'Pendiente · una sola fuente';
    if(evidence.length>1)merged.notes=`Coincidencia en ${evidence.length} referencias; revisar concordancia de cargo y empresa. ${merged.notes||''}`.trim();
    return merged;
  });
}

async function fetchJson(url, {signal}={}) {
  let response;try{response=await fetch(url,{headers:{Accept:'application/json'},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal});}catch(error){throw new Error(`Fallo de red sin reintento automático: ${error.cause?.code||error.name||'error'} · ${error.message}`);}
  if(!response.ok)throw new Error(`HTTP ${response.status} en ${new URL(url).hostname}${response.status===403||response.status===429||response.status===500?' (el servidor o su filtro rechazó la solicitud; no se reintenta ni se elude el bloqueo)':''}`);
  const type=response.headers.get('content-type')||'';if(!type.includes('json'))throw new Error('El proveedor no devolvió JSON público; respuesta omitida.');
  return response.json();
}

export async function searchGuanajuatoPublic(query, {maxResults=5,maxRequests=10,delayMs=900,signal,onRequest}={}) {
  if(globalThis.chrome?.permissions&&!(await chrome.permissions.contains({origins:['https://boletines.guanajuato.gob.mx/*']})))throw new Error('Habilita el permiso opcional para el API público de boletines de Guanajuato.');
  const budget={left:Math.min(20,Math.max(1,Number(maxRequests)||10)),calls:0};
  const request=async url=>{if(budget.left<=0)throw new Error('Límite de solicitudes del lote agotado.');if(budget.calls)await pause(Math.max(500,Math.min(5000,delayMs)));budget.left--;budget.calls++;onRequest?.({url,calls:budget.calls,remaining:budget.left});return fetchJson(url,{signal});};
  const endpoint=new URL('/wp-json/wp/v2/search',GUANAJUATO_WP);endpoint.searchParams.set('search',query);endpoint.searchParams.set('per_page',String(Math.min(10,Math.max(1,maxResults))));
  const index=await request(endpoint.href);const articles=[];const errors=[];
  for(const item of (Array.isArray(index)?index:[]).slice(0,maxResults)){
    if(budget.left<=0){errors.push({url:item.url||'',message:'Límite de solicitudes alcanzado antes de leer todos los resultados.'});break;}
    const self=item._links?.self?.[0]?.href;
    if(!self||!validOfficialArticleUrl(self)){errors.push({url:item.url||'',message:'Resultado sin endpoint REST oficial permitido; omitido.'});continue;}
    try{
      const post=await request(self);const articleUrl=post.link||item.url;
      if(!validOfficialArticleUrl(articleUrl))throw new Error('URL de publicación fuera del dominio oficial permitido.');
      articles.push({id:post.id||item.id,title:decodeTitle(post.title?.rendered||item.title||''),url:articleUrl,publishedAt:post.date||'',content:post.content?.rendered||post.excerpt?.rendered||'',description:cleanHtml(post.excerpt?.rendered||''),source:'Boletines oficiales de Guanajuato · API REST público',providerId:'guanajuato-public'});
    }catch(error){errors.push({url:item.url||self,message:error.message});}
  }
  const candidates=articles.flatMap(article=>extractProfessionalCandidates(article,{query}));
  const partial=errors.some(error=>/Límite de solicitudes alcanzado/.test(error.message));
  return {providerId:'guanajuato-public',query,articles,candidates:crossValidateCandidates(candidates),errors,requestCount:budget.calls,remainingRequests:budget.left,completed:!partial};
}

export async function runDiscoveryBatch({queries=[],providerId='guanajuato-public',braveApiKey='',approvedDomains=[],hintedCompany='',maxResultsPerQuery=3,maxRequests=12,delayMs=900,startIndex=0,initialResults=[],initialReferences=[],initialErrors=[],signal,onProgress}={}) {
  const cleanQueries=[...new Set(queries.map(x=>String(x).trim()).filter(Boolean))].slice(0,10);
  const results=[...initialResults],references=[...initialReferences],errors=[...initialErrors];let used=0,nextIndex=startIndex,blocked=false;
  for(let i=startIndex;i<cleanQueries.length;i++){
    if(used>=maxRequests){blocked=true;nextIndex=i;errors.push({query:cleanQueries[i],providerId,message:'Límite de solicitudes del lote; reanudar desde esta consulta.'});break;}
    const query=cleanQueries[i];
    try{
      if(providerId==='guanajuato-public'){
        const result=await searchGuanajuatoPublic(query,{maxResults:maxResultsPerQuery,maxRequests:Math.max(1,maxRequests-used),delayMs,signal,onRequest:e=>{used++;onProgress?.({queryIndex:i,query,requestCount:used,remainingRequests:Math.max(0,maxRequests-used),phase:'solicitando API pública'});}});
        results.push(...result.candidates);references.push(...result.articles.map(({content,...article})=>article));errors.push(...result.errors.map(error=>({...error,query,providerId})));
        if(!result.completed){blocked=true;nextIndex=i;await onProgress?.({queryIndex:i+1,query,requestCount:used,remainingRequests:Math.max(0,maxRequests-used),phase:'lote pausado por límite; reanudar manualmente',results:[...results],references:[...references],errors:[...errors]});break;}
      }else if(providerId==='brave'||providerId==='linkedin-index'){
        if(used>=maxRequests)throw new Error('Límite de solicitudes del lote agotado.');
        if(used)await pause(Math.max(500,Math.min(5000,delayMs)));
        const q=providerId==='linkedin-index'?`site:linkedin.com/in ${query}`:query;used++;
        const indexed=await searchBrave(q,braveApiKey,maxResultsPerQuery,0,{signal});
        references.push(...indexed);
        const candidates=indexed.flatMap(r=>{const linkedin=linkedinCandidate(r,query);if(linkedin)return [linkedin];return providerId==='linkedin-index'?[]:extractProfessionalCandidates({title:r.title,content:r.description,url:r.url,source:r.source,providerId:'brave-index',publishedAt:''},{query,hintedCompany});});
        results.push(...candidates);
      }else if(providerId==='brave-approved-pages'){
        if(!Array.isArray(approvedDomains)||approvedDomains.length===0)throw new Error('Añade los dominios HTTPS exactos que autorizas y habilita sus permisos antes de extraer páginas.');
        if(!braveApiKey)throw new Error('La búsqueda para descubrir URLs requiere tu clave Brave; la lectura HTML de páginas aprobadas no usa otra API.');
        if(used>=maxRequests)throw new Error('Límite de solicitudes del lote agotado.');
        if(used)await pause(Math.max(500,Math.min(5000,delayMs)));
        used++;const indexed=await searchBrave(query,braveApiKey,maxResultsPerQuery,0,{signal});references.push(...indexed);
        const eligible=indexed.filter(r=>{try{return approvedDomains.includes(new URL(r.url).hostname.toLowerCase())}catch{return false}}).slice(0,maxResultsPerQuery);
        for(const result of eligible){if(used+2>maxRequests){errors.push({query,providerId,url:result.url,message:'Límite de solicitudes alcanzado; reanuda el lote para continuar.'});break;}try{const article=await fetchApprovedPublicPage(result.url,{approvedDomains,signal,onRequest:()=>{used++;onProgress?.({queryIndex:i+1,query,requestCount:used,remainingRequests:Math.max(0,maxRequests-used),phase:'robots.txt y página permitida'});}});references.push(article);results.push(...extractProfessionalCandidates(article,{query,hintedCompany}));}catch(error){errors.push({query,providerId,url:result.url,message:error.message});}}
      }else throw new Error(`Proveedor no reconocido: ${providerId}`);
    }catch(error){errors.push({query,providerId,message:error.message});blocked=true;nextIndex=i;await onProgress?.({queryIndex:i+1,query,requestCount:used,remainingRequests:Math.max(0,maxRequests-used),phase:'lote pausado por error; reanudar solo manualmente',results:[...results],references:[...references],errors:[...errors]});break;}
    nextIndex=i+1;
    await onProgress?.({queryIndex:i+1,query,requestCount:used,remainingRequests:Math.max(0,maxRequests-used),phase:'consulta terminada',results:[...results],references:[...references],errors:[...errors]});
    if(used>=maxRequests&&i<cleanQueries.length-1){blocked=true;nextIndex=i+1;errors.push({query:cleanQueries[i+1],providerId,message:'Límite de solicitudes del lote; lote pausado para reanudar.'});break;}
  }
  return {providerId,queries:cleanQueries,results:crossValidateCandidates(results),references,errors,requestCount:used,completed:!blocked&&nextIndex>=cleanQueries.length,nextIndex};
}

export function draftFromUserSelection({text,pageUrl,title=''}) {
  const excerpt=String(text||'').trim();if(!excerpt)throw new Error('Pega primero el texto que seleccionaste manualmente en la página.');
  return {fullName:'',title:'',company:'',description:excerpt.slice(0,4000),source:'Fragmento seleccionado manualmente',evidenceUrl:pageUrl||'',notes:title?`Título de página declarado: ${title}`:'',verificationStatus:'pendiente',discoveryStatus:'pendiente',confidence:'Sin verificar'};
}
