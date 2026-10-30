import { writeFile } from 'node:fs/promises';
import { runDiscoveryBatch } from '../src/sources.js';

const query=process.env.DISCOVERY_QUERY||'Martinrea Silao manufactura Guanajuato';
const startedAt=new Date().toISOString();
const result=await runDiscoveryBatch({
  queries:[query],providerId:'guanajuato-public',maxResultsPerQuery:3,maxRequests:4,delayMs:500
});
const report={
  test:'live-public-discovery',startedAt,finishedAt:new Date().toISOString(),query,
  provider:'Boletines oficiales de Guanajuato · WordPress REST API pública',
  requestBudget:4,requestsUsed:result.requestCount,candidateCount:result.results.length,
  status:result.results.length?'PASS':'BLOCKED',completed:result.completed,nextIndex:result.nextIndex,
  candidates:result.results.map(({fullName,title,company,locality,state,evidenceUrl,verificationStatus})=>({fullName,title,company,locality,state,evidenceUrl,verificationStatus})),
  references:result.references,errors:result.errors,
  note:result.results.length?'Candidatos extraídos por la extensión del motor desde la API pública.':'La consulta real no produjo candidatos; no presentar demo como descubrimiento.'
};
await writeFile(new URL('../docs/live-discovery-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!result.results.length)process.exitCode=1;
