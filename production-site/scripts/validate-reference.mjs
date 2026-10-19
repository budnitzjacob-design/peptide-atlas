import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
function load(prefix=''){const x={window:{}};vm.createContext(x);for(const f of ['data.js','sandbox-data.js'])vm.runInContext(fs.readFileSync(prefix+f,'utf8'),x);return [...x.window.PEPTIDE_ATLAS_DATA.peptides,...x.window.PEPTIDE_SANDBOX_DATA.candidatePeptides];}
const old=load('baseline/'),now=load(),ids=new Set();let citationsRetained=0,claimsRetained=0;
assert.equal(now.length,48);
for(const p of now){assert(!ids.has(p.id));ids.add(p.id);assert(p.concise.mechanism&&p.concise.risk&&p.concise.context);const prior=old.find(q=>q.id===p.id);for(const cite of prior.citations){assert(p.citations.some(c=>c.id===cite.id));citationsRetained++;}for(const claim of prior.claims){assert(p.claims.some(c=>c.id===claim.id));claimsRetained++;}const refs=new Set(p.citations.map(c=>c.id));for(const id of p.researchUpdate?.citationIds||[])assert(refs.has(id));}
assert.equal(now.find(p=>p.id==='orforglipron').classification.regulatoryStatus,'fda_approved');
assert.equal(now.find(p=>p.id==='retatrutide').classification.regulatoryStatus,'investigational');
console.log(JSON.stringify({records:now.length,originalCitationsRetained:citationsRetained,originalClaimsRetained:claimsRetained,researchUpdates:now.filter(p=>p.researchUpdate).length},null,2));
