import fs from 'node:fs/promises';
import path from 'node:path';

export async function normalizeMirrorShardPaths(root='data/notion-mirror/databases'){
  let dirs=[];
  try{dirs=await fs.readdir(root,{withFileTypes:true});}catch{return;}
  for(const dir of dirs.filter(x=>x.isDirectory())){
    const file=path.join(root,dir.name,'index.json');
    const data=JSON.parse(await fs.readFile(file,'utf8'));
    data.shards=(data.shards||[]).map(shard=>({...shard,file:shard.file.startsWith('data/data/')?shard.file:`data/${shard.file}`}));
    await fs.writeFile(file,`${JSON.stringify(data)}\n`);
  }
}
