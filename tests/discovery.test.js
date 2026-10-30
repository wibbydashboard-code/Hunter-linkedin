import { afterEach, describe, expect, it, vi } from 'vitest';
import { crossValidateCandidates, extractProfessionalCandidates, fetchApprovedPublicPage, parseJsonLdPeople, robotsAllows, runDiscoveryBatch } from '../src/sources.js';

const articleUrl='https://boletines.guanajuato.gob.mx/2026/09/30/crece-martinrea-en-guanajuato-con-inversion-de-50-mdd/';
// Fictitious names substituted for public distribution; source structure is retained for parser regression.
const articleContent=`Silao, Gto. 30 de septiembre de 2026.- Martinrea invirtió 50 millones de dólares en su planta de Silao. Alex Demo Uno, Gerente General de Martinrea Planta Silao, explicó que el proyecto incorpora nueva tecnología. Casey Demo Dos, Cofundador y Presidente Ejecutivo del Consejo de Administración de Martinrea International, señaló la apuesta de la empresa. En esta inauguración participaron Taylor Demo Tres, Vicepresidente Ejecutivo de Martinrea Metálicos; Sam Demo Cinco, Directora de Desarrollo Económico y Turismo; así como Morgan Demo Cuatro, Gerente de Operaciones Martinrea Planta Silao.`;
const officialArticle={title:'Crece Martinrea en Guanajuato con inversión de 50 MDD',url:articleUrl,publishedAt:'2026-09-30T10:00:00',content:articleContent,source:'Boletines oficiales de Guanajuato · API REST público',providerId:'guanajuato-public'};

afterEach(()=>vi.unstubAllGlobals());

describe('motor de descubrimiento V1.1',()=>{
  it('extrae nuevos candidatos profesionales del artículo público de Martinrea con cargo, empresa, localidad y evidencia',()=>{
    const people=extractProfessionalCandidates(officialArticle,{query:'Martinrea Silao manufactura Guanajuato'});
    expect(people.map(x=>x.fullName)).toEqual(['Alex Demo Uno','Casey Demo Dos','Taylor Demo Tres','Morgan Demo Cuatro']);
    expect(people[0]).toMatchObject({title:'Gerente General de Martinrea Planta Silao',company:'Martinrea',locality:'Silao',state:'Guanajuato',discoveryStatus:'descubierto',verificationStatus:'pendiente'});
    expect(people.find(x=>x.fullName==='Casey Demo Dos')).toMatchObject({locality:'',state:''});
    expect(people.every(x=>x.evidenceUrl===articleUrl&&x.sourceEvidence.length===1&&!x.corporateEmail)).toBe(true);
    expect(people.every(x=>!x.profileUrl)).toBe(true);
  });

  it('lee Schema.org JSON-LD Person sin abrir sameAs de LinkedIn',()=>{
    const html='<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"Pat Example","jobTitle":"Plant Manager","worksFor":{"@type":"Organization","name":"Acme Manufacturing"},"address":{"@type":"PostalAddress","addressLocality":"Silao","addressRegion":"Guanajuato","addressCountry":"MX"},"sameAs":"https://www.linkedin.com/in/pat-example"}</script>';
    expect(parseJsonLdPeople(html)).toEqual([{fullName:'Pat Example',title:'Plant Manager',company:'Acme Manufacturing',locality:'Silao',state:'Guanajuato',country:'MX',profileUrl:'https://www.linkedin.com/in/pat-example'}]);
    const people=extractProfessionalCandidates({title:'Acme Manufacturing Leadership',url:'https://acme.example/leadership',content:'Equipo corporativo',structuredPeople:parseJsonLdPeople(html),source:'Página pública aprobada · acme.example',providerId:'approved-public-page'});
    expect(people[0]).toMatchObject({fullName:'Pat Example',title:'Plant Manager',company:'Acme Manufacturing',profileUrl:'https://www.linkedin.com/in/pat-example',verificationStatus:'pendiente'});
  });

  it('cumple reglas robots.txt por coincidencia de prefijo y prevalencia específica de Allow',()=>{
    const robots='User-agent: *\nDisallow: /private\nAllow: /private/public\n';
    expect(robotsAllows(robots,'https://acme.example/public/team')).toBe(true);
    expect(robotsAllows(robots,'https://acme.example/private/team')).toBe(false);
    expect(robotsAllows(robots,'https://acme.example/private/public/team')).toBe(true);
    expect(robotsAllows('User-agent: *\nDisallow: /','https://acme.example/about')).toBe(false);
  });

  it('verifica automáticamente solo coincidencias alineadas en dos hosts distintos',()=>{
    const base={fullName:'Pat Example',title:'Plant Manager',company:'Acme',verificationStatus:'pendiente'};
    const sameSite=crossValidateCandidates([{...base,sourceEvidence:[{url:'https://acme.example/about'}]},{...base,sourceEvidence:[{url:'https://acme.example/team'}]}])[0];
    expect(sameSite.verificationStatus).toBe('pendiente');expect(sameSite.crossSourceCount).toBe(1);
    const independent=crossValidateCandidates([{...base,sourceEvidence:[{url:'https://acme.example/about'}]},{...base,sourceEvidence:[{url:'https://trade.example/interview'}]}])[0];
    expect(independent.verificationStatus).toBe('verificado por fuentes cruzadas');expect(independent.crossSourceCount).toBe(2);
  });

  it('solo solicita robots.txt y página HTML del host exacto aprobado y convierte JSON-LD en ficha',async()=>{
    const calls=[];
    vi.stubGlobal('fetch',vi.fn(async(url)=>{
      calls.push(String(url));
      if(String(url).endsWith('/robots.txt'))return new Response('User-agent: *\nDisallow: /private',{status:200,headers:{'content-type':'text/plain'}});
      return new Response('<html><head><title>Acme Leadership</title><script type="application/ld+json">{"@type":"Person","name":"Jordan Sample","jobTitle":"Operations Manager","worksFor":{"name":"Acme Manufacturing"}}</script></head><body><main>Manufacturing operations and plant leadership</main></body></html>',{status:200,headers:{'content-type':'text/html','content-length':'350'}});
    }));
    const page=await fetchApprovedPublicPage('https://acme.example/leadership',{approvedDomains:['acme.example']});
    const people=extractProfessionalCandidates(page,{query:'manufacturing'});
    expect(calls).toEqual(['https://acme.example/robots.txt','https://acme.example/leadership']);
    expect(people[0]).toMatchObject({fullName:'Jordan Sample',title:'Operations Manager',company:'Acme Manufacturing'});
    await expect(fetchApprovedPublicPage('https://unapproved.example/leadership',{approvedDomains:['acme.example']})).rejects.toThrow(/host exacto aprobado/);
  });

  it('respeta límites y permite reanudar lote desde el siguiente query tras el checkpoint',async()=>{
    const calls=[];
    vi.stubGlobal('fetch',vi.fn(async(url)=>{
      calls.push(String(url));
      if(String(url).includes('/wp-json/wp/v2/search?'))return new Response(JSON.stringify([{id:7,title:'Crece Martinrea en Guanajuato',url:articleUrl,_links:{self:[{href:'https://boletines.guanajuato.gob.mx/wp-json/wp/v2/posts/7'}]}}]),{status:200,headers:{'content-type':'application/json'}});
      return new Response(JSON.stringify({id:7,date:'2026-09-30T10:00:00',link:articleUrl,title:{rendered:officialArticle.title},content:{rendered:articleContent}}),{status:200,headers:{'content-type':'application/json'}});
    }));
    const first=await runDiscoveryBatch({queries:['Martinrea Silao manufactura','Martinrea operaciones Guanajuato'],providerId:'guanajuato-public',maxResultsPerQuery:1,maxRequests:2,delayMs:500});
    expect(first.requestCount).toBeLessThanOrEqual(2);expect(first.completed).toBe(false);expect(first.nextIndex).toBe(1);expect(first.results).toHaveLength(4);
    const checkpointCalls=calls.length;
    const resumed=await runDiscoveryBatch({queries:first.queries,providerId:'guanajuato-public',maxResultsPerQuery:1,maxRequests:2,delayMs:500,startIndex:first.nextIndex,initialResults:first.results,initialReferences:first.references,initialErrors:first.errors});
    expect(calls.length-checkpointCalls).toBeLessThanOrEqual(2);expect(resumed.completed).toBe(true);expect(resumed.results).toHaveLength(4);expect(new Set(resumed.results.map(x=>x.fullName)).size).toBe(4);
  });

  it('registra bloqueo HTTP 500, se detiene sin reintentar la siguiente consulta y deja checkpoint reanudable',async()=>{
    let calls=0;
    vi.stubGlobal('fetch',vi.fn(async()=>{calls++;return new Response('{"display_message":"Web Page Blocked!"}',{status:500,headers:{'content-type':'application/json'}});}));
    const batch=await runDiscoveryBatch({queries:['Martinrea Silao','Martinrea Guanajuato'],providerId:'guanajuato-public',maxRequests:10,delayMs:500});
    expect(calls).toBe(1);expect(batch.completed).toBe(false);expect(batch.nextIndex).toBe(0);expect(batch.errors[0].message).toMatch(/HTTP 500/);
  });
});
