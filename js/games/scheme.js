'use strict';
/* Original rule-diagram questions. Four related items share one rule board.
   Reversible operators make input-reconstruction questions mathematically sound. */
const SCHEME_OPERATORS=[
  {id:'left',name:'맨 앞 문자를 맨 뒤로 이동',apply:s=>s.slice(1)+s[0],undo:s=>s.at(-1)+s.slice(0,-1),type:'pos'},
  {id:'right',name:'맨 뒤 문자를 맨 앞으로 이동',apply:s=>s.at(-1)+s.slice(0,-1),undo:s=>s.slice(1)+s[0],type:'pos'},
  {id:'reverse',name:'문자열 순서 뒤집기',apply:s=>[...s].reverse().join(''),undo:s=>[...s].reverse().join(''),type:'pos'},
  {id:'outer',name:'첫 번째와 네 번째 문자 교환',apply:s=>s[3]+s[1]+s[2]+s[0],undo:s=>s[3]+s[1]+s[2]+s[0],type:'pos'},
  {id:'inner',name:'두 번째와 세 번째 문자 교환',apply:s=>s[0]+s[2]+s[1]+s[3],undo:s=>s[0]+s[2]+s[1]+s[3],type:'pos'},
  {id:'pairs',name:'1↔2, 3↔4 위치 교환',apply:s=>s[1]+s[0]+s[3]+s[2],undo:s=>s[1]+s[0]+s[3]+s[2],type:'pos'},
  {id:'plus1',name:'각 문자/숫자를 한 칸 뒤로 이동(+1)',apply:s=>schemeShift(s,1),undo:s=>schemeShift(s,-1),type:'shift'},
  {id:'plus2',name:'각 문자/숫자를 두 칸 뒤로 이동(+2)',apply:s=>schemeShift(s,2),undo:s=>schemeShift(s,-2),type:'shift'},
  {id:'minus1',name:'각 문자/숫자를 한 칸 앞으로 이동(−1)',apply:s=>schemeShift(s,-1),undo:s=>schemeShift(s,1),type:'shift'},
  {id:'minus2',name:'각 문자/숫자를 두 칸 앞으로 이동(−2)',apply:s=>schemeShift(s,-2),undo:s=>schemeShift(s,2),type:'shift'}
];
const SCHEME_MARKS=['◆','▲','●','■'];
function schemeShift(str,k){const numeric=/^[0-9]+$/.test(str),start=numeric?48:65,n=numeric?10:26;return [...str].map(c=>String.fromCharCode(start+((c.charCodeAt(0)-start+k+n*2)%n))).join('');}
function schemeOp(id){return SCHEME_OPERATORS.find(o=>o.id===id);}
function schemeFreshSet(){
  const codes=shuffle([ ...shuffle(SCHEME_OPERATORS.filter(o=>o.type==='pos')).slice(0,2),...shuffle(SCHEME_OPERATORS.filter(o=>o.type==='shift')).slice(0,2)]);
  // Demonstrations use unique letters, making the operation identifiable from the example.
  const kind=Math.random()<.5?'digits':'letters';
  const samples=kind==='digits'?['1234','5807','9761','4025']:['ABCD','GHTW','MPQZ','RXUY'];
  return shuffle(SCHEME_MARKS).map((mark,i)=>({mark,op:codes[i].id,kind,sample:samples[i],output:codes[i].apply(samples[i])}));
}
function schemeApply(set,route,s){return route.reduce((v,mark)=>schemeOp(set.find(x=>x.mark===mark).op).apply(v),s);}
function schemeUndo(set,route,s){return [...route].reverse().reduce((v,mark)=>schemeOp(set.find(x=>x.mark===mark).op).undo(v),s);}
function schemeCode(kind='letters'){return Array.from({length:4},()=>String.fromCharCode(kind==='digits'?48+random(0,9):65+random(0,25))).join('');}
function schemeDistractors(answer,set,route,input,output){
  const bank=[input,output,[...answer].reverse().join(''),schemeShift(answer,1),schemeShift(answer,-1),
    schemeShift(answer,2),schemeShift(answer,-2),answer.slice(1)+answer[0],answer.at(-1)+answer.slice(0),
    answer[1]+answer[0]+answer[3]+answer[2],answer[3]+answer[1]+answer[2]+answer[0],
    schemeApply(set,[...route].reverse(),input)];
  const items=[...new Set(bank.filter(s=>s!==answer))];
  while(items.length<4){const i=random(0,3);const c=String.fromCharCode(set[0].kind==='digits'?48+random(0,9):65+random(0,25));const v=answer.slice(0,i)+c+answer.slice(i+1);if(v!==answer&&!items.includes(v))items.push(v);}
  return shuffle(items).slice(0,4);
}
function makeSchemeQuestion({session}){
  if(!session.schemeBoard || session.index%4===0){session.schemeBoard=schemeFreshSet();session.schemeNumber=(session.schemeNumber||0)+1;}
  const set=session.schemeBoard.map(o=>({...o}));
  const part=session.index%4;
  const marks=set.map(o=>o.mark);
  const route=shuffle(marks).slice(0,[2,3,3,4][part]);
  const input=schemeCode(set[0].kind),output=schemeApply(set,route,input),backward=part===2;
  const answer=backward?schemeUndo(set,route,output):output;
  const alternatives=shuffle([answer,...schemeDistractors(answer,set,route,input,output)]);
  const trace=[input];for(const mark of route)trace.push(schemeApply(set,[mark],trace.at(-1)));
  return {set,part,group:session.schemeNumber,route,backward,source:backward?output:input,answer,correctIndex:alternatives.indexOf(answer),alternatives,
    explanation:route.map((mark,i)=>`${mark} ${schemeOp(set.find(x=>x.mark===mark).op).name}`).join(' → ')+' · '+trace.join(' → ')};
}
function schemeRuleBoard(q){return `<section class="scheme-board" aria-label="공통 변환 도식">
   <div class="scheme-board-head"><strong>공통 도식 <span>${q.group}세트</span></strong><small>아래 4개 기호의 변환 규칙은 이번 4문항에서 동일합니다.</small></div>
   <div class="scheme-operators">${q.set.map((op,i)=>`<div class="scheme-operator"><span class="scheme-op-num">${String(i+1).padStart(2,'0')}</span><span class="scheme-example">${op.sample}</span><span class="scheme-arrow">→</span><span class="scheme-shape">${op.mark}</span><span class="scheme-arrow">→</span><strong class="scheme-example">${op.output}</strong></div>`).join('')}</div>
   <p class="scheme-board-foot">같은 도형은 언제나 같은 규칙 · 알파벳 Z→A / 숫자 9→0 순환</p>
 </section>`;}
function renderSchemeQuestion(q){return `<section class="scheme-paper">
    <div class="scheme-counter"><span>도식 ${q.group} · 연결 문항 <strong>${q.part+1}/4</strong></span><span>${q.backward?'역방향 추론':'정방향 변환'}</span></div>
    ${schemeRuleBoard(q)}
    <div class="scheme-task"><div class="scheme-task-label">${q.backward?'다음 도식을 거친 결과에서 최초 입력을 찾으세요.':'기호의 순서대로 변환했을 때 결과를 찾으세요.'}</div>
      <div class="scheme-chain"><strong>${q.backward?'????':q.source}</strong>${q.route.map(m=>`<span class="scheme-chain-arrow">→</span><span class="scheme-chain-mark">${m}</span>`).join('')}<span class="scheme-chain-arrow">→</span><strong class="scheme-chain-target">${q.backward?q.source:'????'}</strong></div>
    </div>
    <div class="reason-choices scheme-choices">${q.alternatives.map((v,i)=>`<button type="button" class="reason-choice" data-scheme-choice="${i}"><span class="reason-choice-number">${['①','②','③','④','⑤'][i]}</span><span class="scheme-option-code">${v}</span></button>`).join('')}</div>
    <div class="feedback reason-feedback" id="answer-feedback" aria-live="polite"></div>
  </section>`;}
function mountSchemeQuestion(q,{root,submit}){$$('[data-scheme-choice]',root).forEach(b=>b.addEventListener('click',()=>submit(Number(b.dataset.schemeChoice),b)));}
registerMode({key:'scheme',title:'도식 추리',subtitle:'공통 변환 도식을 보고 4개 연결 문항을 풉니다.',tag:'REASONING / SCHEME',art:'◆→▲',
 makeQuestion:makeSchemeQuestion,render:renderSchemeQuestion,mount:mountSchemeQuestion,
 checkAnswer(q,v){return {correct:Number(v)===q.correctIndex,explanation:q.explanation};}});
