import {request,mapLimit} from './notion/api.mjs';
import {TDAS_SOURCE_MANIFEST} from './notion/source-manifest.mjs';
const compact=value=>String(value??'').replaceAll('-','').toLowerCase();
const required=(condition,message)=>{if(!condition)throw new Error(`Acesso às fontes-mestre TDAS: ${message}`)};
const pages=[TDAS_SOURCE_MANIFEST.root,TDAS_SOURCE_MANIFEST.editalCheck,TDAS_SOURCE_MANIFEST.planningRoot,TDAS_SOURCE_MANIFEST.macro,...TDAS_SOURCE_MANIFEST.micros];
const results=await mapLimit(pages,4,async page=>{
 const data=await request(`/pages/${compact(page.id)}`);
 required(data?.object==='page',`${page.name} não retornou como página.`);
 const titleProperty=Object.values(data.properties||{}).find(item=>item?.type==='title');
 const title=(titleProperty?.title||[]).map(item=>item.plain_text||item.text?.content||'').join('');
 required(!/EDAS|Cargo\s*400/i.test(`${page.name} ${title}`),`${page.name} aponta para Cargo 400.`);
 return{page,data};
});
const planning=results.find(item=>compact(item.page.id)===compact(TDAS_SOURCE_MANIFEST.planningRoot.id))?.data;
required(planning,'raiz Macro + Micros não localizada.');
for(const item of results.filter(item=>item.page===TDAS_SOURCE_MANIFEST.macro||TDAS_SOURCE_MANIFEST.micros.includes(item.page))){
 const parent=item.data?.parent?.page_id||'';
 required(!parent||compact(parent)===compact(TDAS_SOURCE_MANIFEST.planningRoot.id),`${item.page.name} saiu da raiz autorizada.`);
}
console.log(`NOTION_TOKEN acessou ${results.length} fontes-mestre TDAS autorizadas; Cargo 400 e Arquivo permanecem fora do manifesto operacional.`);
