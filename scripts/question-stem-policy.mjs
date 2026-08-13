export function isValidQuestionStem(value){
 const stem=String(value??'').replace(/\s+/g,' ').trim();
 if(stem.length<5)return false;
 const words=stem.split(/\s+/).filter(Boolean);
 return words.length>=2||stem.length>=10;
}
