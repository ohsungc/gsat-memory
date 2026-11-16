'use strict';
  // 5. Propositional/set reasoning. Each question is verified against all 4-element
  // finite interpretations of A, B, C (4096 cases) before its distractors are shown.
  // Important: universal claims do NOT imply existence; some(A,B) is symmetric,
  // while all(A,B) is NOT. This avoids accidental valid extra answers.
  const REASON_SYMBOLS=['A','B','C'];
  const REASON_NUMBER=['①','②','③','④'];
  const stmt=(kind,from,to)=>({kind,from,to});
  const ALL_CANDIDATES=[];
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(a!==b){
    for(const kind of ['all','none','some','someNot'])ALL_CANDIDATES.push(stmt(kind,a,b));
  }
  const REASON_PATTERNS=[
    {id:'chain', p:stmt('all',0,1), b:stmt('all',1,2), c:stmt('all',0,2), note:'A가 B에 포함되고 B가 C에 포함되므로, A도 C에 포함됩니다.'},
    {id:'exclusion',p:stmt('all',0,1),b:stmt('none',1,2),c:stmt('none',0,2),note:'A의 구성원은 모두 B에 속하고, B와 C는 서로 겹치지 않습니다.'},
    {id:'witness',p:stmt('some',0,1),b:stmt('all',1,2),c:stmt('some',0,2),note:'A이면서 B인 대상이 실제로 존재하고, 모든 B는 C이므로 그 대상은 C에도 속합니다.'},
    {id:'some-not',p:stmt('some',0,1),b:stmt('none',1,2),c:stmt('someNot',0,2),note:'A이면서 B인 대상이 존재하며, B인 대상은 어떤 것도 C가 아닙니다.'},
    {id:'shared',p:stmt('some',0,1),b:stmt('all',0,2),c:stmt('some',1,2),note:'A와 B에 함께 속하는 대상은 모두 A이므로 C에도 속합니다.'},
    {id:'reverse-witness',p:stmt('all',0,1),b:stmt('some',2,0),c:stmt('some',2,1),note:'C이면서 A인 대상이 존재합니다. 그 대상은 B이기도 합니다.'},
    {id:'not-b',p:stmt('none',0,1),b:stmt('some',0,2),c:stmt('someNot',2,1),note:'A이면서 C인 대상이 존재하고, A와 B는 서로 겹치지 않습니다.'},
    {id:'reverse-all',p:stmt('all',1,0),b:stmt('none',0,2),c:stmt('none',1,2),note:'B는 A의 일부이며, A는 C와 겹치지 않으므로 B도 C와 겹치지 않습니다.'},
    {id:'negative-witness',p:stmt('someNot',0,1),b:stmt('all',0,2),c:stmt('someNot',2,1),note:'A 중 B가 아닌 대상이 존재하며, 그 대상은 C에도 속합니다.'},
    {id:'not-overlap',p:stmt('some',1,2),b:stmt('none',0,1),c:stmt('someNot',2,0),note:'B와 C에 함께 속하는 대상이 존재하지만, B는 A와 겹치지 않습니다.'}
  ];
  function reasonText(r){
    const a=REASON_SYMBOLS[r.from],b=REASON_SYMBOLS[r.to];
    if(r.kind==='all')return `모든 ${a}는 ${b}이다.`;
    if(r.kind==='none')return `어떤 ${a}도 ${b}가 아니다.`;
    if(r.kind==='some')return `어떤 ${a}는 ${b}이다.`;
    return `어떤 ${a}는 ${b}가 아니다.`;
  }
  // Each element belongs to any combination of the three sets (0..7 bitmask).
  // Four elements are sufficient to validate all these deliberately bounded patterns.
  function holds(rule,world){
    const a=1<<rule.from,b=1<<rule.to;
    for(let i=0;i<4;i++){
      const mask=(world>>(i*3))&7;
      const yesA=Boolean(mask&a),yesB=Boolean(mask&b);
      if(rule.kind==='all' && yesA&&!yesB)return false;
      if(rule.kind==='none' && yesA&&yesB)return false;
      if(rule.kind==='some' && yesA&&yesB)return true;
      if(rule.kind==='someNot' && yesA&&!yesB)return true;
    }
    return rule.kind==='all'||rule.kind==='none';
  }
  function reasonEntails(premises,conclusion){
    let any=false;
    for(let w=0;w<4096;w++){
      if(!premises.every(p=>holds(p,w)))continue;
      any=true;
      if(!holds(conclusion,w))return false;
    }
    return any;
  }
  function reasonSatisfiable(premises){
    for(let w=0;w<4096;w++)if(premises.every(p=>holds(p,w)))return true;
    return false;
  }
  function remapStatement(rule,mapping){return stmt(rule.kind,mapping[rule.from],mapping[rule.to]);}
  function statementKey(r){return [r.kind,r.from,r.to].join(':');}
  function makeReasonQuestion({session,state,shuffle,pick}){
    const modeSetting=state.settings.reasoningStyle||'mixed';
    const task=modeSetting==='mixed'?pick(['conclusion','bridge']):modeSetting;
    let template=pick(REASON_PATTERNS);
    if(session.lastQuestionSignature===task+template.id){
      template=pick(REASON_PATTERNS.filter(p=>p.id!==template.id));
    }
    session.lastQuestionSignature=task+template.id;
    const map=shuffle([0,1,2]);
    const given=remapStatement(template.p,map);
    const bridge=remapStatement(template.b,map);
    const conclusion=remapStatement(template.c,map);
    const fullPremises=[given,bridge];
    const optionsPool=ALL_CANDIDATES.filter(v=>{
      const key=statementKey(v);
      if([given,bridge,conclusion].some(x=>statementKey(x)===key))return false;
      if(task==='conclusion'){
        return !reasonEntails(fullPremises,v);
      }
      return reasonSatisfiable([given,v])&&!reasonEntails([given,v],conclusion);
    });
    // The correct answer is proven, not merely assumed from the pattern name.
    const correct=task==='conclusion'?conclusion:bridge;
    const premises=task==='conclusion'?fullPremises:[given];
    if(!reasonSatisfiable(premises)||
      !(task==='conclusion'?reasonEntails(premises,correct):reasonEntails([given,correct],conclusion))||
      optionsPool.length<3){throw Error('Invalid logic question template: '+template.id);}
    // Distractors preferentially reuse the same pair or set involved in the answer.
    const ranked=shuffle(optionsPool).sort((a,b)=>{
      const score=r=>(r.from===correct.from?2:0)+(r.to===correct.to?2:0)+
        (r.from===correct.to?1:0)+(r.to===correct.from?1:0)+(r.kind===correct.kind?1:0);
      return score(b)-score(a);
    });
    const alternatives=shuffle([correct,...ranked.slice(0,3)]);
    const correctIndex=alternatives.findIndex(v=>statementKey(v)===statementKey(correct));
    return {task,premises,conclusion,alternatives,correctIndex,
      explanation:reasonText(correct)+' '+template.note,
      key:template.id};
  }
  function renderReasonQuestion(q){
    const isBridge=q.task==='bridge';
    const intro=isBridge?'주어진 명제와 선지를 함께 참이라고 할 때, 아래 결론이 반드시 성립하도록 하는 선지는?':'다음 명제들이 참일 때, 반드시 참인 선지는?';
    return `<section class="reason-paper" aria-label="집합 추론 문제">
      <div class="reason-meta"><span>집합 · 명제</span><span>${isBridge?'중간 다리':'참인 결론'}</span></div>
      <p class="reason-intro">${intro}</p>
      <div class="reason-premises">${q.premises.map((r,i)=>`<div class="reason-premise"><span class="reason-p-label">${isBridge?'주어진 명제':`명제 ${i+1}`}</span><span>${escapeHtml(reasonText(r))}</span></div>`).join('')}
      ${isBridge?`<div class="reason-connector" aria-hidden="true">＋ ?</div><div class="reason-premise reason-goal"><span class="reason-p-label">결론</span><span>${escapeHtml(reasonText(q.conclusion))}</span></div>`:''}</div>
      <div class="reason-choices">${q.alternatives.map((r,i)=>`<button class="reason-choice" type="button" data-logic-choice="${i}" aria-label="${i+1}번 ${escapeHtml(reasonText(r))}"><span class="reason-choice-number">${REASON_NUMBER[i]}</span><span>${escapeHtml(reasonText(r))}</span></button>`).join('')}</div>
      <div class="feedback reason-feedback" id="answer-feedback" aria-live="polite"></div>
      <p class="reason-hint">‘모든 A는 B’가 참이어도 A가 실제로 존재한다는 뜻은 아닙니다.</p>
    </section>`;
  }
  function mountReasonQuestion(q,{root,submit}){
    $$('.reason-choice',root).forEach(b=>b.addEventListener('click',()=>{
      const index=Number(b.dataset.logicChoice);
      if(index!==q.correctIndex){
        const right=$(`[data-logic-choice="${q.correctIndex}"]`,root);
        right?.classList.add('reason-answer-reveal');
      }
      submit(index,b);
    }));
  }
  registerMode({
    key:'reason',title:'집합 · 명제 추론',subtitle:'포함관계를 판별하고, 참인 결론 또는 중간 명제를 고르세요.',tag:'LOGIC / SETS',art:'A⊂B',
    makeQuestion:makeReasonQuestion,render:renderReasonQuestion,mount:mountReasonQuestion,
    checkAnswer(q,value){return {correct:Number(value)===q.correctIndex,explanation:q.explanation};}
  });
