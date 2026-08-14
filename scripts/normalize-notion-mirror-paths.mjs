import fs from 'node:fs/promises';
import path from 'node:path';

function stripSignedUrls(value){
  if(Array.isArray(value))return value.map(stripSignedUrls);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const[k,v]of Object.entries(value))out[k]=stripSignedUrls(v);
  if(out.notionHosted===true&&Object.prototype.hasOwnProperty.call(out,'url'))out.url=null;
  return out;
}

export async function normalizeMirrorShardPaths(root='data/notion-mirror/databases'){
  let dirs=[];
  try{dirs=await fs.readdir(root,{withFileTypes:true});}catch{}
  for(const dir of dirs.filter(x=>x.isDirectory())){
    const file=path.join(root,dir.name,'index.json');
    const data=stripSignedUrls(JSON.parse(await fs.readFile(file,'utf8')));
    data.shards=(data.shards||[]).map(shard=>({...shard,file:shard.file.startsWith('data/data/')?shard.file:`data/${shard.file}`}));
    await fs.writeFile(file,`${JSON.stringify(data)}\n`);
    for(const shard of data.shards||[]){
      const source=shard.file.replace(/^data\/data\//,'data/');
      try{const payload=stripSignedUrls(JSON.parse(await fs.readFile(source,'utf8')));await fs.writeFile(source,`${JSON.stringify(payload)}\n`);}catch{}
    }
  }
  let pages=[];
  try{pages=await fs.readdir('data/notion-mirror/pages',{withFileTypes:true});}catch{}
  for(const entry of pages.filter(x=>x.isFile()&&x.name.endsWith('.json'))){
    const file=path.join('data/notion-mirror/pages',entry.name),data=stripSignedUrls(JSON.parse(await fs.readFile(file,'utf8')));
    await fs.writeFile(file,`${JSON.stringify(data)}\n`);
  }
}
