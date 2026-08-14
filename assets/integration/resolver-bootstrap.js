const params=new URLSearchParams(location.search);
const reviewId=params.get('review');
const bankMode=params.get('modo')==='banco'&&!reviewId;
if(reviewId){
 document.documentElement.dataset.questionMode='review';
 const{installReviewCatalogBridge}=await import('./review-catalog-bridge.js?v=1.0.0');
 await installReviewCatalogBridge(reviewId);
 await import('./module-player.js?v=2.1.0');
 await import('./question-telemetry-runtime.js?v=1.0.0');
}else if(bankMode){
 document.documentElement.dataset.questionMode='bank';
 await import('./question-bank-player.js?v=1.0.0');
 await import('./question-telemetry-runtime.js?v=1.0.0');
}else{
 document.documentElement.dataset.questionMode='daily';
 await import('./module-player.js?v=2.1.0');
 await import('./question-telemetry-runtime.js?v=1.0.0');
 await import('./daily-question-page.js?v=1.0.2');
}
