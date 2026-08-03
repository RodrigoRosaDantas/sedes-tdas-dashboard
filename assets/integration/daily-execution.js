import {BASE} from '../common.js?v=24.1';
const NOTION='https://app.notion.com/p/';
let contractPromise=null;
export function normalizePe(value){const n=Number(String(value??'').replace(/\D/g,''));return Number.isInteger(n)&&n>=1&&n<=112?`PE${String(n).padStart(2,'0')}`:null}
export function peNumber(value){const pe=normalizePe(value);return pe?Number(pe.slice(2)):null}
export async function loadDailyExecution(){
 if(!contractPromise)contractPromise=fetch(BASE+'data/integration/daily-execution.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`Falha ao carregar a execução diária (${r.status}).`);return r.json()}).then(raw=>{
  if(raw?.mode!=='daily-execution-contract'||raw.materialPageIds?.length!==112||raw.questionPageIds?.length!==112)throw new Error('Contrato da execução diária inválido.');
  const items=raw.materialPageIds.map((materialId,index)=>{const number=index+1;return Object.freeze({pe:`PE${String(number).padStart(2,'0')}`,number,week:Math.ceil(number/7),materialUrl:NOTION+materialId,questionsUrl:NOTION+raw.questionPageIds[index]})});
  return Object.freeze({...raw,items:Object.freeze(items)});
 });
 return contractPromise;
}
export function findDailyExecution(contract,value){const pe=normalizePe(value);return pe?contract.items.find(item=>item.pe===pe)||null:null}
export function selectedPe(currentPe){return normalizePe(new URLSearchParams(globalThis.location?.search||'').get('pe'))||normalizePe(currentPe)}
export function peDetailPath(value){const n=peNumber(value);return n?`${BASE}pe/${n}/`:BASE+'pe/'}
