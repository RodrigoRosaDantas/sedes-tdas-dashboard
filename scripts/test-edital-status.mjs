import assert from 'node:assert/strict';
import {syncEditalStatus} from './notion/edital-status.mjs';

const status=await syncEditalStatus({write:false});
assert.ok(status.summary.total>=80,'Checklist do Edital retornou cobertura insuficiente.');
assert.equal(status.summary.contentGaps,status.summary.coverage.not_studied);
assert.ok(Array.isArray(status.disciplines)&&status.disciplines.length>=8,'Disciplinas do edital não foram consolidadas.');
assert.ok(Array.isArray(status.priorityTopics)&&status.priorityTopics.length>0,'Raio-X do edital não gerou prioridades.');
assert.equal(status.topics.some(item=>/EDAS|Cargo\s*400/i.test(`${item.topic} ${item.discipline} ${item.block}`)),false,'Cargo 400 contaminou o checklist TDAS.');
console.log(`Checklist vivo validado: ${status.summary.total} tópicos, ${status.summary.risk.critical} críticos, ${status.summary.risk.attention} em atenção.`);
console.log(`EDITAL_STATUS_SUMMARY=${JSON.stringify(status.summary)}`);
console.log(`EDITAL_CRITICAL_TOPICS=${JSON.stringify(status.topics.filter(item=>item.risk==='critical').map(item=>({topic:item.topic,discipline:item.discipline,block:item.block,priority:item.priority,nextAction:item.nextAction||item.strategicAction,url:item.url})))}`);
console.log(`EDITAL_DISCIPLINES=${JSON.stringify(status.disciplines)}`);
