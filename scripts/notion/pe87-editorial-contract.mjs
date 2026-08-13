import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const required=(condition,message)=>{if(!condition)throw new Error(message)};

export function validatePe87EditorialContract({catalog,key}={}){
  if(String(catalog?.peId||'').toUpperCase()!=='PE87')return{applicable:false,reason:'PE diferente'};
  const q20=(catalog.questions||[]).find(question=>Number(question?.numeroOriginal)===20);
  if(!q20)return{applicable:false,reason:'Q20 ausente'};
  const stem=normalize(q20.enunciado),optionA=normalize(q20.alternativas?.A);
  const currentPratoCheio=stem.includes('cartao prato cheio')&&optionA.includes('7.009/2021')&&optionA.includes('42.873/2021');
  if(!currentPratoCheio)return{applicable:false,reason:'Q20 não corresponde ao contrato editorial vigente'};
  const answer=(key?.answers||[]).find(item=>item.id===q20.id)?.gabarito;
  required(answer==='A',`PE87: Q20 do Cartão Prato Cheio exige gabarito A para a associação Lei 7.009/2021 + Decreto 42.873/2021; recebido ${answer||'ausente'}. Publicação bloqueada.`);
  return{applicable:true,questionId:q20.id,answer};
}

export async function validateGeneratedPe87EditorialContract(root=process.cwd()){
  const catalog=JSON.parse(await fs.readFile(path.join(root,'data/integration/question-catalog.json'),'utf8'));
  if(String(catalog?.peId||'').toUpperCase()!=='PE87')return validatePe87EditorialContract({catalog,key:null});
  const key=JSON.parse(await fs.readFile(path.join(root,'data/integration/question-keys/pe87.json'),'utf8'));
  return validatePe87EditorialContract({catalog,key});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await validateGeneratedPe87EditorialContract();
  console.log(JSON.stringify({contract:'pe87-prato-cheio',...result}));
}
