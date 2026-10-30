import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { addManyProspects, getAll } from '../src/db.js';
import { SEED_CATEGORIES, classifyProspect, findDuplicates, makeProspect, scoreProspect, validateWeights } from '../src/domain.js';
import { parseImport, toCsv, toJsonBackup, toXlsx } from '../src/exporters.js';

function synthetic(i) {
  return makeProspect({
    fullName: `Prospecto Sintético ${i}`, title: i % 2 ? 'Director de compras' : 'CEO', company: `Empresa Sintética ${i}`,
    industry: 'Manufactura automotriz', locality: 'León', state: 'Guanajuato', country: 'México',
    companyWebsite: `https://empresa${i}.example.test`, profileUrl: `https://example.test/person/${i}`,
    source: 'DEMO — datos ficticios', evidenceUrl: 'https://example.test/demo',
    verificationStatus: 'no verificado', confidence: 'Sin verificar', notes: 'Registro sintético para pruebas automatizadas'
  });
}

describe('Prospect Hunter B2B', () => {
  it('construye y clasifica 100 prospectos de demostración claramente ficticios', () => {
    const rows = Array.from({length:100},(_,i)=>synthetic(i+1));
    expect(rows).toHaveLength(100);
    expect(rows.every(p=>p.source.startsWith('DEMO'))).toBe(true);
    const classified=classifyProspect(rows[0],SEED_CATEGORIES);
    expect(classified.some(x=>x.id==='procurement'||x.id==='ceo')).toBe(true);
  });

  it('detecta duplicados exactos por URL canónica y dominio+nombre, y separa probables', () => {
    const original=makeProspect({fullName:'José Antonio García Ramírez López',company:'Acme',companyWebsite:'https://www.acme.example',profileUrl:'https://linkedin.com/in/jose-garcia/?trk=abc'});
    const sameUrl=makeProspect({fullName:'Jose Garcia',company:'Otra',profileUrl:'https://linkedin.com/in/jose-garcia'});
    expect(findDuplicates(sameUrl,[original]).exact).toHaveLength(1);
    const domainName=makeProspect({fullName:'Jose Antonio Garcia Ramirez Lopez',company:'ACME',companyWebsite:'https://acme.example'});
    expect(findDuplicates(domainName,[original]).exact).toHaveLength(1);
    const probable=makeProspect({fullName:'Jose Antonio Garcia Ramirez Lopez Sanchez',company:'Acme',companyWebsite:'https://acme.example'});
    expect(findDuplicates(probable,[original]).probable).toHaveLength(1);
  });

  it('calcula afinidad ICP sin otorgar puntos por información ausente', () => {
    const full=makeProspect({fullName:'Ana Pérez',title:'CEO',industry:'manufactura automotriz',locality:'León',state:'Guanajuato',company:'Empresa 1',keywords:['automatización']});
    const profile={factors:{title:30,sector:25,location:20,company:15,keywords:10},criteria:{title:['ceo'],sector:['manufactura'],location:['guanajuato'],company:['empresa 1'],keywords:['automatización']}};
    const result=scoreProspect(full,profile);
    expect(result.score).toBe(100); expect(result.coverage).toBe(100);
    const missing=makeProspect({fullName:'Ana Pérez'});
    const partial=scoreProspect(missing,profile);
    expect(partial.score).toBe(0); expect(partial.coverage).toBe(0);
    expect(validateWeights({a:30,b:70})).toEqual({valid:true,total:100});
    expect(validateWeights({a:30,b:60}).valid).toBe(false);
  });

  it('persiste 100 registros de prueba en IndexedDB y los recupera', async () => {
    const rows=Array.from({length:100},(_,i)=>synthetic(i+1));
    expect(await addManyProspects(rows)).toBe(100);
    const saved=await getAll('prospects');
    expect(saved).toHaveLength(100);
    expect(saved[0].history[0].action).toBe('importado');
  });

  it('importa el CSV demo de 100 filas, clasifica cargos y detecta la segunda copia', async () => {
    const bytes=await readFile(new URL('../demo/demo-prospects.csv',import.meta.url));
    const rows=await parseImport(new File([bytes],'demo-prospects.csv',{type:'text/csv'}));
    expect(rows).toHaveLength(100);
    expect(rows.every(row=>String(row.source).includes('ficticios'))).toBe(true);
    expect(classifyProspect(makeProspect(rows[0]),SEED_CATEGORIES).length).toBeGreaterThan(0);
    const seen=[];let duplicates=0;
    for(const row of [...rows,...rows]){const candidate=makeProspect(row);if(findDuplicates(candidate,seen).exact.length)duplicates++;else seen.push(candidate);}
    expect(seen).toHaveLength(100);expect(duplicates).toBe(100);
  });

  it('mantiene la demo sintética separada de contactos privados o archivos del piloto', async () => {
    const bytes=await readFile(new URL('../demo/demo-prospects.csv',import.meta.url));
    const rows=await parseImport(new File([bytes],'demo-prospects.csv',{type:'text/csv'}));
    expect(rows).toHaveLength(100);
    expect(rows.every(row=>String(row.source).includes('ficticios'))).toBe(true);
    expect(rows.every(row=>!row.corporateEmail&&!row.phone)).toBe(true);
  });

  it('protege fórmulas en CSV y XLSX y conserva acentos y metadatos', async () => {
    const row=makeProspect({fullName:'Ángel Núñez',title:'=HYPERLINK("https://evil.test")',company:'+Empresa',locality:'León',state:'Guanajuato',notes:'@SUM(A1:A2)',evidenceUrl:'-cmd'});
    const csv=toCsv([row]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('Ángel Núñez');
    expect(csv).toContain("'+Empresa");
    const importedCsv=await parseImport(new File([csv],'leads.csv',{type:'text/csv'}));
    expect(importedCsv[0].fullName).toBe('Ángel Núñez');
    expect(importedCsv[0].title).toBe("'=HYPERLINK(\"https://evil.test\")");
    const xlsx=await toXlsx([row],'2026-10-25T00:00:00.000Z');
    const importedXlsx=await parseImport(new File([xlsx],'leads.xlsx'));
    expect(importedXlsx[0].fullName).toBe('Ángel Núñez');
    expect(importedXlsx[0].title).toBe("'=HYPERLINK(\"https://evil.test\")");
    expect(importedXlsx[0].locality).toBe('León');
  });

  it('exporta y reimporta un respaldo JSON restaurable', async () => {
    const row=makeProspect({fullName:'Prospecto Sintético 42',title:'CEO',company:'Empresa Sintética 42',state:'Guanajuato',source:'DEMO — datos ficticios'});
    const backup=toJsonBackup([row],{label:'prueba'});
    const imported=await parseImport(new File([backup],'respaldo.json',{type:'application/json'}));
    expect(imported).toHaveLength(1); expect(imported[0].fullName).toBe('Prospecto Sintético 42'); expect(imported[0].state).toBe('Guanajuato');
  });
});
