import assert from 'node:assert/strict';
import {buildReinforcementReview,inferReviewOutcome,outcomeLabel,reinforcementDelayDays,REVIEW_OUTCOMES,reviewPriorityScore,sortReviewsByPriority} from '../assets/integration/review-engine.js';

assert.equal(inferReviewOutcome({correct:true,confidence:'secure'}),REVIEW_OUTCOMES.MASTERED);
assert.equal(inferReviewOutcome({correct:true,confidence:'doubt'}),REVIEW_OUTCOMES.UNSURE);
assert.equal(inferReviewOutcome({correct:false,confidence:'secure'}),REVIEW_OUTCOMES.WRONG_AGAIN);
assert.equal(outcomeLabel(REVIEW_OUTCOMES.MASTERED),'Dominei');
assert.equal(reinforcementDelayDays(REVIEW_OUTCOMES.UNSURE),3);
assert.equal(reinforcementDelayDays(REVIEW_OUTCOMES.WRONG_AGAIN),1);
assert.equal(reinforcementDelayDays(REVIEW_OUTCOMES.MASTERED),null);

const finishedAt=1_000_000;
const sourceReview={id:'review:source',rootReviewId:'review:root',peId:'PE79',recurrenceCount:1};
const item={id:'q7',classification:'incorrect_confirmed',confidence:'secure',correct:false};
const wrong=buildReinforcementReview({sourceReview,item,attemptId:'attempt:review:1',finishedAt,outcome:REVIEW_OUTCOMES.WRONG_AGAIN});
assert.equal(wrong.stage,'Reforço 24h');
assert.equal(wrong.dueAt,finishedAt+86_400_000);
assert.equal(wrong.recurrenceCount,2);
assert.equal(wrong.rootReviewId,'review:root');
assert.equal(wrong.sourceOutcome,REVIEW_OUTCOMES.WRONG_AGAIN);
const unsure=buildReinforcementReview({sourceReview,item:{...item,correct:true},attemptId:'attempt:review:2',finishedAt,outcome:REVIEW_OUTCOMES.UNSURE});
assert.equal(unsure.stage,'Reforço 3d');
assert.equal(unsure.dueAt,finishedAt+3*86_400_000);
assert.equal(buildReinforcementReview({sourceReview,item,attemptId:'attempt:review:3',finishedAt,outcome:REVIEW_OUTCOMES.MASTERED}),null);

const now=10*86_400_000;
const ordered=sortReviewsByPriority([
 {id:'normal',dueAt:now-5*86_400_000,classification:'marked',recurrenceCount:0},
 {id:'recurrent',dueAt:now-1_000,sourceOutcome:'wrong_again',recurrenceCount:2},
 {id:'doubt',dueAt:now-2*86_400_000,sourceOutcome:'unsure',recurrenceCount:1},
],now);
assert.equal(ordered[0].id,'recurrent');
assert.ok(reviewPriorityScore(ordered[0],now)>reviewPriorityScore(ordered[1],now));
console.log('Motor adaptativo validado: domínio sem reforço extra, dúvida em 3 dias, novo erro em 24h e reincidência priorizada.');
