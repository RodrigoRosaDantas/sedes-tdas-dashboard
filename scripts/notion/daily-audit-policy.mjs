const COMPLETED_PATTERN=/conclu|finaliz|feito|realiz/i;

export function canUseHistoricalExecution(control,today){
 const date=String(control?.date||'');
 const status=String(control?.status||'');
 const expected=Number(control?.expectedCount);
 const attempted=Number(control?.attempted);
 const correct=Number(control?.correct);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{4}-\d{2}-\d{2}$/.test(String(today||'')))return false;
 if(date>=today)return false;
 if(!COMPLETED_PATTERN.test(status))return false;
 if(!Number.isInteger(expected)||expected<=0)return false;
 if(!Number.isInteger(attempted)||attempted!==expected)return false;
 if(!Number.isInteger(correct)||correct<0||correct>expected)return false;
 return true;
}

export function correctionPolicy({control,answerCount,today}){
 const expected=Number(control?.expectedCount||0);
 if(expected===0)return{mode:'not-applicable',accepted:true};
 if(Number(answerCount)===expected)return{mode:'answer-key',accepted:true};
 if(canUseHistoricalExecution(control,today))return{mode:'historical-execution',accepted:true};
 return{mode:'blocked',accepted:false};
}
