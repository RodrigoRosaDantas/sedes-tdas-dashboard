const params=new URLSearchParams(location.search);
const bankMode=params.get('modo')==='banco'&&!params.get('review');
if(bankMode){
 document.documentElement.dataset.questionMode='bank';
 await import('./question-bank-player.js?v=1.0.0');
 await import('./question-telemetry-runtime.js?v=1.0.0');
}else{
 document.documentElement.dataset.questionMode=params.get('review')?'review':'daily';
 await import('./module-player.js?v=2.1.0');
 await import('./question-telemetry-runtime.js?v=1.0.0');
 await import('./daily-question-page.js?v=1.0.2');
}
