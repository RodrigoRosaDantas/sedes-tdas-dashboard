import assert from 'node:assert/strict';
import {normalizePe, readPeProgress, resetPeProgress, setPeProgress, summarizeProgress, updateProgress} from '../assets/integration/daily-progress.js';

function memoryStorage(){
 const values=new Map();
 return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}

const storage=memoryStorage();
assert.equal(normalizePe('77'),'PE77');
assert.equal(normalizePe('PE8'),'PE08');
assert.equal(normalizePe(0),null);
assert.equal(normalizePe(113),null);
assert.deepEqual(summarizeProgress(readPeProgress('PE77',storage)),{material:false,questions:false,registered:false,updatedAt:null,completed:0,total:3,percent:0,done:false});
setPeProgress('PE77','material',true,storage,'2026-08-03T04:10:00.000Z');
setPeProgress('PE77','questions',true,storage,'2026-08-03T04:11:00.000Z');
assert.deepEqual(summarizeProgress(readPeProgress('PE77',storage)),{material:true,questions:true,registered:false,updatedAt:'2026-08-03T04:11:00.000Z',completed:2,total:3,percent:67,done:false});
assert.equal(readPeProgress('PE78',storage).material,false,'PE distintos devem permanecer isolados.');
setPeProgress('PE77','registered',true,storage,'2026-08-03T04:12:00.000Z');
const completed=summarizeProgress(readPeProgress('PE77',storage));
assert.equal(completed.percent,100);
assert.equal(completed.done,true);
setPeProgress('PE77','questions',false,storage,'2026-08-03T04:13:00.000Z');
assert.equal(readPeProgress('PE77',storage).questions,false,'Etapas devem poder ser desmarcadas.');
resetPeProgress('PE77',storage);
assert.equal(summarizeProgress(readPeProgress('PE77',storage)).completed,0);
assert.throws(()=>updateProgress({},'invalid'),/Etapa diária inválida/);
assert.throws(()=>setPeProgress('PE113','material',true,storage),/PE inválido/);
console.log('Acompanhamento local testado: persistência, isolamento por PE, conclusão, desmarcação e limpeza.');
