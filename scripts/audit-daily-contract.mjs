import fs from 'node:fs/promises';
const contract=JSON.parse(await fs.readFile('data/integration/daily-execution.json','utf8'));
const materialKnown={
  71:'364cf5a26731811398c3dedd3fbf5f11',72:'364cf5a2673181e3bd7cd3838bcb1c67',73:'364cf5a26731817bbfc6dc7cd4f2f7ab',74:'364cf5a2673181e7a1a1d8dbac887ae8',75:'364cf5a26731817eb3ebc241ac479d99',76:'364cf5a267318116ac67e405688a4f2d',77:'364cf5a267318155bc19f39487b0b543',78:'364cf5a2673181ff90cfe4606151c599',79:'364cf5a2673181c7a745f414b2ec5242',80:'364cf5a26731815fb24fd8ad724813f1',81:'364cf5a26731812c9bd4cc31069051b8',82:'364cf5a2673181ffb3e0f73ca58b590f',83:'364cf5a26731815abd50eed8f76cdc94',84:'364cf5a267318174be0fe1abd21787d2'};
const questionKnown={
  71:'364cf5a2673181a1be09d92b174298a0',72:'364cf5a2673181339a04d59766745b93',73:'364cf5a2673181d595aecbb026718f79',74:'364cf5a26731810aadb1f0f8a401c69d',75:'364cf5a267318147b8edf8793c1c3b53',76:'364cf5a26731810e929fe919d7d5b37b',77:'364cf5a26731812991d9c98cc9c421a9',78:'364cf5a2673181a8ad7ae8ed70efc0a5',79:'364cf5a26731811f8f34d173584460f6',80:'364cf5a2673181c8aa23cffa24274bab',81:'364cf5a2673181f9bb57ea8a84579b1e',82:'364cf5a267318180831afd472ccaf9b3',83:'364cf5a2673181aab0ade31c503a1a13',84:'364cf5a2673181dd9f04d2083ca1a2de'};
const errors=[];
for(const [pe,id] of Object.entries(materialKnown))if(contract.materialPageIds[Number(pe)-1]!==id)errors.push({type:'material',pe:Number(pe),expected:id,actual:contract.materialPageIds[Number(pe)-1]});
for(const [pe,id] of Object.entries(questionKnown))if(contract.questionPageIds[Number(pe)-1]!==id)errors.push({type:'question',pe:Number(pe),expected:id,actual:contract.questionPageIds[Number(pe)-1]});
console.log(JSON.stringify({lengths:{materials:contract.materialPageIds.length,questions:contract.questionPageIds.length},unique:{materials:new Set(contract.materialPageIds).size,questions:new Set(contract.questionPageIds).size},slice:Array.from({length:14},(_,i)=>({pe:i+71,material:contract.materialPageIds[i+70],question:contract.questionPageIds[i+70]})),errors},null,2));
if(errors.length)process.exitCode=1;
