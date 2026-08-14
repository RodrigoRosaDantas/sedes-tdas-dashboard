import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const commands=String(pkg.scripts?.check||'').split(/\s*&&\s*/u).map(value=>value.trim()).filter(Boolean);
if(!commands.length)throw new Error('Script check não encontrado.');
for(const command of commands){
 console.log(`\n▶ ${command}`);
 const result=spawnSync(command,{shell:true,stdio:'inherit',env:process.env});
 if(result.status!==0){
  console.error(`::error title=Gate integral TDAS::Falhou: ${command.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')}`);
  process.exit(result.status||1);
 }
}
console.log(`\nGate integral concluído: ${commands.length} verificações executadas.`);
