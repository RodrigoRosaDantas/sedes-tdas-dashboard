const COMPLETED_PATTERN=/conclu|finaliz|feito|realiz/i;

export function canUseHistoricalExecution(control,today){
 const date=String(control?.date||'');
 const status=String(control?.status||'');
 const expected=Number(control?.expectedCount);
 const attempted=Number(control?.attempted);
 const correct=Number(control?.correct);
 const errors=Number(control?.errors);
 const accuracy=Number(control?.accuracy);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{4}-\d{2}-\d{2}$/.test(String(today||'')))return false;
 if(date>=today)return false;
 if(!COMPLETED_PATTERN.test(status))return false;
 if(!Number.isInteger(expected)||expected<=0)return false;
 if(!Number.isInteger(correct)||correct<0||correct>expected)return false;
 const attemptedCloses=Number.isInteger(attempted)&&attempted===expected;
 const resultCloses=Number.isInteger(errors)&&errors>=0&&correct+errors===expected;
 const expectedAccuracy=correct/expected*100;
 const accuracyCloses=correct>0&&Number.isFinite(accuracy)&&accuracy>=0&&accuracy<=100&&Math.abs(accuracy-expectedAccuracy)<=0.02;
 if(!attemptedCloses&&!resultCloses&&!accuracyCloses)return false;
 return true;
}

export function correctionPolicy({control,answerCount,today}){
 const expected=Number(control?.expectedCount||0);
 if(expected===0)return{mode:'not-applicable',accepted:true};
 if(Number(answerCount)===expected)return{mode:'answer-key',accepted:true};
 if(canUseHistoricalExecution(control,today))return{mode:'historical-execution',accepted:true};
 console.warn('DAILY_AUDIT_POLICY_BLOCKED',JSON.stringify({today,date:control?.date,status:control?.status,expected,answerCount,attempted:control?.attempted,correct:control?.correct,errors:control?.errors,accuracy:control?.accuracy}));
 return{mode:'blocked',accepted:false};
}
