'use strict';
/* Independent, original GSAT-style conditional reasoning generators.
   Every seating/order/propositional answer is evaluated over ALL legal models. */
const DEDUCT_TYPES=[
  {id:'seat',title:'좌석 배치 · 2열×4행'},
  {id:'order',title:'순서 정하기'},
  {id:'truth',title:'참말 · 거짓말'},
  {id:'proposition',title:'논리 명제'},
  {id:'probability',title:'확률 · 경우의 수'}
];
const DEDUCT_NUM=['①','②','③','④','⑤'];
function permuteN(n){
  const out=[];function go(a,mask){if(a.length===n){out.push([...a]);return;}for(let i=0;i<n;i++)if(!(mask&(1<<i))){a.push(i);go(a,mask|(1<<i));a.pop();}}go([],0);return out;
}
const DEDUCT_SEATS=permuteN(8); // positional array: index=seat; value=person (0..7)
const DEDUCT_ORDERS=permuteN(6);
const SEAT_NAMES=['A','B','C','D','E','F','G','H'];
const ORDER_NAMES=['가람','나래','다온','라온','마루','바다'];
function dedIndex(p,person){return p.indexOf(person);}
function dedSeatRow(p,person){return Math.floor(dedIndex(p,person)/2);}
function dedSeatCol(p,person){return dedIndex(p,person)%2;}
function dedSeatPredicate(kind,a,b){
  const name=SEAT_NAMES[a],other=SEAT_NAMES[b]||'';
  if(kind==='row')return {kind,a,b,text:`${name}는 ${b+1}행에 앉는다.`,test:p=>dedSeatRow(p,a)===b};
  if(kind==='col')return {kind,a,b,text:`${name}는 ${b===0?'왼쪽':'오른쪽'} 열에 앉는다.`,test:p=>dedSeatCol(p,a)===b};
  if(kind==='before')return {kind,a,b,text:`${name}는 ${other}보다 앞 행에 앉는다.`,test:p=>dedSeatRow(p,a)<dedSeatRow(p,b)};
  if(kind==='sameRow')return {kind,a,b,text:`${name}와 ${other}는 같은 행에 앉는다.`,test:p=>dedSeatRow(p,a)===dedSeatRow(p,b)};
  if(kind==='sameCol')return {kind,a,b,text:`${name}와 ${other}는 같은 열에 앉는다.`,test:p=>dedSeatCol(p,a)===dedSeatCol(p,b)};
  return {kind,a,b,text:`${name}와 ${other}는 바로 앞뒤로 앉는다.`,test:p=>dedSeatCol(p,a)===dedSeatCol(p,b)&&Math.abs(dedSeatRow(p,a)-dedSeatRow(p,b))===1};
}
function dedSeatPool(){const list=[];
  for(let a=0;a<8;a++){
    for(let r=0;r<4;r++)list.push(dedSeatPredicate('row',a,r));
    for(let c=0;c<2;c++)list.push(dedSeatPredicate('col',a,c));
    for(let b=0;b<8;b++)if(a!==b){list.push(dedSeatPredicate('before',a,b));
      if(a<b){list.push(dedSeatPredicate('sameRow',a,b));list.push(dedSeatPredicate('sameCol',a,b));list.push(dedSeatPredicate('neighbor',a,b));}}
  }return list;
}
const SEAT_POOL=dedSeatPool();
function dedOrderPredicate(kind,a,b){
  const n=ORDER_NAMES[a],m=ORDER_NAMES[b]||'';
  if(kind==='position')return {kind,a,b,text:`${n}는 ${b+1}번째이다.`,test:p=>dedIndex(p,a)===b};
  if(kind==='before')return {kind,a,b,text:`${n}는 ${m}보다 먼저 도착했다.`,test:p=>dedIndex(p,a)<dedIndex(p,b)};
  if(kind==='adjacent')return {kind,a,b,text:`${n}와 ${m}는 연속으로 도착했다.`,test:p=>Math.abs(dedIndex(p,a)-dedIndex(p,b))===1};
  if(kind==='gap2')return {kind,a,b,text:`${n}와 ${m} 사이에는 정확히 한 사람이 있다.`,test:p=>Math.abs(dedIndex(p,a)-dedIndex(p,b))===2};
  return {kind,a,b,text:`${n}는 ${b===0?'첫':'마지막'} 순서가 아니다.`,test:p=>dedIndex(p,a)!==(b===0?0:5)};
}
function dedOrderPool(){const list=[];for(let a=0;a<6;a++){
 for(let p=0;p<6;p++)list.push(dedOrderPredicate('position',a,p));
 for(let b=0;b<6;b++)if(a!==b){list.push(dedOrderPredicate('before',a,b));if(a<b){list.push(dedOrderPredicate('adjacent',a,b));list.push(dedOrderPredicate('gap2',a,b));}}
 list.push(dedOrderPredicate('notEdge',a,0));list.push(dedOrderPredicate('notEdge',a,1));
 }return list;}
const ORDER_POOL=dedOrderPool();
function dedPickClues(all,pool,target,minModels,maxModels){
  let models=all,clues=[],used=new Set();
  const candidates=shuffle(pool.filter(item=>item.test(target))).slice(0,64);
  for(let r=0;r<6;r++){
    const scored=[];
    for(const c of candidates){if(used.has(c.text))continue;
      const next=models.filter(c.test);
      if(next.length<minModels||next.length===models.length)continue;
      const goal=Math.sqrt(models.length*maxModels);
      const quality=Math.abs(Math.log(next.length/goal));
      scored.push({c,next,quality});
    }
    if(!scored.length)break;
    scored.sort((a,b)=>a.quality-b.quality);
    const chosen=pick(scored.slice(0,Math.min(8,scored.length)));
    used.add(chosen.c.text);clues.push(chosen.c);models=chosen.next;
    if(models.length<=maxModels && clues.length>=3)break;
  }
  return {clues,models};
}
function dedOptions(pool,models,clues,askTrue){
  const seen=new Set(clues.map(c=>c.text));
  const labels=shuffle(pool.filter(c=>!seen.has(c.text)));
  const counts=labels.map(c=>({...c,num:models.reduce((n,m)=>n+Number(c.test(m)),0)}));
  const correct=counts.filter(c=>askTrue?c.num===models.length:c.num===0);
  const maybe=counts.filter(c=>c.num>0&&c.num<models.length);
  const other=counts.filter(c=>askTrue?c.num<models.length:c.num>0);
  if(!correct.length||other.length<4||maybe.length<2)return null;
  const chosen=pick(correct);
  const distractors=shuffle([...shuffle(maybe).slice(0,3),...shuffle(other.filter(c=>!maybe.includes(c))).slice(0,5)]).slice(0,4);
  if(distractors.length<4)return null;
  const options=shuffle([chosen,...distractors]);
  return {options:options.map(o=>o.text),correctIndex:options.indexOf(chosen),answerProof:chosen.text,
    proofCount:models.length,askTrue};
}
function makeSeatQuestion(){
  for(let attempt=0;attempt<18;attempt++){
    const target=pick(DEDUCT_SEATS);
    const {clues,models}=dedPickClues(DEDUCT_SEATS,SEAT_POOL,target,5,90);
    if(clues.length<3||models.length>250)continue;
    const askTrue=Math.random()<.5;
    const options=dedOptions(SEAT_POOL,models,clues,askTrue);
    if(!options)continue;
    return {kind:'seat',headline:`다음 좌석 배치 조건을 만족할 때, ${askTrue?'항상 참':'항상 거짓'}인 것은?`,
      lead:'A~H 8명이 4행×2열 좌석에 한 명씩 앉는다. 앞 행은 1행이며 빈 좌석은 없다.',
      clues:clues.map(c=>c.text),...options,
      explanation:`조건을 만족하는 배치를 모두 검사하면 ${models.length}가지입니다. ${options.answerProof} — ${askTrue?'모든 배치에서 성립합니다.':'어느 배치에서도 성립하지 않습니다.'}`};
  }
  throw Error('Could not generate a valid seating question');
}
function makeOrderQuestion(){
  for(let attempt=0;attempt<16;attempt++){
    const target=pick(DEDUCT_ORDERS);
    const {clues,models}=dedPickClues(DEDUCT_ORDERS,ORDER_POOL,target,3,32);
    if(clues.length<3||models.length>70)continue;
    const askTrue=Math.random()<.5;
    const options=dedOptions(ORDER_POOL,models,clues,askTrue);
    if(!options)continue;
    return {kind:'order',headline:`다음 조건을 만족할 때, ${askTrue?'항상 참':'항상 거짓'}인 것은?`,
      lead:`${ORDER_NAMES.join('·')} 6명이 각각 다른 순서로 도착했다.`,clues:clues.map(c=>c.text),...options,
      explanation:`가능한 도착 순서 ${models.length}가지를 모두 확인하면 ${options.answerProof} — ${askTrue?'항상 성립합니다.':'성립할 수 없습니다.'}`};
  }throw Error('Could not generate order question');
}
function makeTruthQuestion(){
 const who=['A','B','C','D'];
 function statement(type,a,b){
   if(type===0)return {text:`열쇠를 가진 사람은 ${who[a]}이다.`,test:x=>x===a};
   if(type===1)return {text:`열쇠를 가진 사람은 ${who[a]}가 아니다.`,test:x=>x!==a};
   const nums=[a,b].sort((x,y)=>x-y);return {text:`열쇠를 가진 사람은 ${who[nums[0]]} 또는 ${who[nums[1]]}이다.`,test:x=>nums.includes(x)};
 }
 for(let attempt=0;attempt<200;attempt++){
   const sayings=Array.from({length:4},()=>{const type=random(0,2),a=random(0,3),b=(a+random(1,3))%4;return statement(type,a,b);});
   if(new Set(sayings.map(s=>s.text)).size!==4)continue;
   const trueCount=random(1,3);
   const fits=[0,1,2,3].filter(k=>sayings.filter(s=>s.test(k)).length===trueCount);
   if(fits.length!==1)continue;
   const answer=who[fits[0]],options=shuffle(who);
   return {kind:'truth',headline:'다음 진술들을 근거로 열쇠를 가진 사람을 고르세요.',
    lead:`A~D 중 단 한 명만 열쇠를 갖고 있다. 네 사람의 진술 중 정확히 ${trueCount}개만 참이다.`,
    clues:sayings.map((s,i)=>`${who[i]}: “${s.text}”`),options,
    correctIndex:options.indexOf(answer),explanation:`${answer}가 열쇠를 가질 때만 참인 진술 수가 정확히 ${trueCount}개입니다.`};
 }
 throw Error('Could not generate truth question');
}
const PROP_WORDS=[['P','신제품 출시 승인'],['Q','예산 확보'],['R','품질 검사 통과']];
const PROP_VALUATIONS=Array.from({length:8},(_,i)=>[Boolean(i&1),Boolean(i&2),Boolean(i&4)]);
function propLit(i,positive=true){return {text:PROP_WORDS[i][positive?0:1],eval:v=>positive?v[i]:!v[i]};}
function propExpr(type,a,b){
  const x=PROP_WORDS[a][0],y=PROP_WORDS[b][0];
  if(type==='imp')return {text:`${x}가 참이면 ${y}도 참이다.`,eval:v=>!v[a]||v[b]};
  if(type==='either')return {text:`${x}와 ${y} 중 적어도 하나는 참이다.`,eval:v=>v[a]||v[b]};
  if(type==='exclusive')return {text:`${x}와 ${y} 중 정확히 하나만 참이다.`,eval:v=>v[a]!==v[b]};
  if(type==='both')return {text:`${x}와 ${y}는 모두 참이다.`,eval:v=>v[a]&&v[b]};
  return {text:`${x}와 ${y}가 동시에 참일 수는 없다.`,eval:v=>!(v[a]&&v[b])};
}
function propPool(){const a=[];
  for(let i=0;i<3;i++){a.push({text:`${PROP_WORDS[i][0]}는 참이다.`,eval:v=>v[i]});a.push({text:`${PROP_WORDS[i][0]}는 거짓이다.`,eval:v=>!v[i]});}
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(i!==j){a.push(propExpr('imp',i,j));if(i<j)for(const ty of ['either','exclusive','both','notBoth'])a.push(propExpr(ty,i,j));}
  return a;
}
const PROP_POOL=propPool();
function makePropositionQuestion(){
  for(let k=0;k<60;k++){
    let models=PROP_VALUATIONS,clues=[];
    const target=pick(models);
    for(const c of shuffle(PROP_POOL.filter(p=>p.eval(target)))){
      if(clues.length>=3)break;
      const next=models.filter(c.eval);
      if(next.length>=2 && next.length<models.length){clues.push(c);models=next;}
    }
    if(clues.length<2||models.length>4)continue;
    const askTrue=Math.random()<.5;
    const options=dedOptions(PROP_POOL.map(x=>({...x,test:x.eval})),models,clues,askTrue);
    if(!options)continue;
    return {kind:'proposition',headline:`다음 조건이 참일 때, ${askTrue?'반드시 참':'반드시 거짓'}인 것은?`,
      lead:'P: 신제품 출시 승인 / Q: 예산 확보 / R: 품질 검사 통과. 세 명제는 각각 참 또는 거짓이다.',
      clues:clues.map(c=>c.text),...options,
      explanation:`조건을 만족하는 경우 ${models.length}가지를 모두 검토하면 ${options.answerProof} — ${askTrue?'모두 참입니다.':'모두 거짓입니다.'}`};
  }
  // This fallback uses a logically sound two-premise implication chain.
  const options=['R는 참이다.','Q는 거짓이다.','P는 거짓이다.','R는 거짓이다.','P와 Q가 모두 거짓이다.'];
  return {kind:'proposition',headline:'다음 조건이 참일 때, 반드시 참인 것은?',lead:'P: 신제품 출시 승인 / Q: 예산 확보 / R: 품질 검사 통과.',
    clues:['P가 참이면 Q도 참이다.','Q가 참이면 R도 참이다.','P는 참이다.'],options,correctIndex:0,
    explanation:'P가 참이므로 Q도 참이고, 따라서 R도 참입니다.'};
}
function dedGcd(a,b){while(b){[a,b]=[b,a%b];}return a;}
function dedFraction(n,d){const g=dedGcd(n,d);return `${n/g}/${d/g}`;}
function dedChoose2(n){return n*(n-1)/2;}
function makeProbabilityQuestion(){
 const colors=shuffle(['파란','빨간','노란']);const nums=Array.from({length:3},()=>random(2,6)),N=nums.reduce((a,b)=>a+b,0),D=dedChoose2(N);
 const kind=random(0,3),c=colors[0],d=colors[1];let numer=0,formula='',target='';
 if(kind===0){numer=dedChoose2(nums[0]);target=`두 공이 모두 ${c}색일 확률은?`;formula=`C(${nums[0]}, 2) / C(${N}, 2)`;}
 else if(kind===1){numer=nums[0]*nums[1];target=`${c}색 1개와 ${d}색 1개를 뽑을 확률은?`;formula=`${nums[0]} × ${nums[1]} / C(${N}, 2)`;}
 else if(kind===2){numer=nums[0]*nums[1]+nums[0]*nums[2]+nums[1]*nums[2];target='뽑은 두 공의 색이 서로 다를 확률은?';formula=`(${nums[0]}×${nums[1]}+${nums[0]}×${nums[2]}+${nums[1]}×${nums[2]}) / C(${N}, 2)`;}
 else {numer=D-dedChoose2(N-nums[0]);target=`${c}색 공을 적어도 한 개 뽑을 확률은?`;formula=`(C(${N}, 2)−C(${N-nums[0]}, 2)) / C(${N}, 2)`;}
 const answer=dedFraction(numer,D);const alternatives=[answer];
 const candidates=[numer-4,numer-3,numer-2,numer-1,numer+1,numer+2,numer+3,numer+4,Math.floor(D/2),D-numer,nums[0]*nums[1],nums[0]].filter(x=>x>0&&x<D);
 for(const x of shuffle(candidates)){const f=dedFraction(x,D);if(!alternatives.includes(f))alternatives.push(f);if(alternatives.length===5)break;}
 while(alternatives.length<5){const a=random(1,D-1),f=dedFraction(a,D);if(!alternatives.includes(f))alternatives.push(f);}
 const options=shuffle(alternatives);
 return {kind:'probability',headline:target,lead:`상자에 ${colors.map((co,i)=>`${co}색 공 ${nums[i]}개`).join(', ')}가 있다. 이 중 2개를 동시에 무작위로 꺼낸다.`,
 clues:[],options,correctIndex:options.indexOf(answer),explanation:`전체 경우의 수 C(${N}, 2)=${D}, 해당 경우의 수 ${numer} · ${formula} = ${answer}`};
}
function makeDeductionQuestion({state}){
 const style=state.settings.deductionStyle||'mixed';const kind=style==='mixed'?balancedPick(DEDUCT_TYPES,'deduction:kind',m=>m.id).id:style;
 if(kind==='seat')return makeSeatQuestion();
 if(kind==='order')return makeOrderQuestion();
 if(kind==='truth')return makeTruthQuestion();
 if(kind==='proposition')return makePropositionQuestion();
 return makeProbabilityQuestion();
}
function renderDeductionQuestion(q){
 const label=DEDUCT_TYPES.find(t=>t.id===q.kind)?.title||'조건추리';
 return `<section class="deduct-paper">
  <div class="deduct-meta"><span>CONDITIONAL REASONING</span><span>${escapeHtml(label)}</span></div>
  <div class="deduct-question">${escapeHtml(q.headline)}</div>
  <p class="deduct-lead">${escapeHtml(q.lead)}</p>
  ${q.kind==='seat'?`<div class="deduct-seat-wrap"><div class="deduct-seat-title">좌석 메모 · 선택한 사람을 빈 좌석에 배치해 보세요 (채점과 무관)</div>
     <div class="deduct-seat-tools">${SEAT_NAMES.map(n=>`<button type="button" data-seat-person="${n}" class="deduct-person">${n}</button>`).join('')}<button type="button" class="deduct-person" data-seat-person="">지우개</button></div>
     <div class="deduct-seat-grid">${Array.from({length:4},(_,r)=>`<span class="deduct-row">${r+1}행</span>${[0,1].map(c=>`<button type="button" class="deduct-seat-cell" data-seat-cell="${r*2+c}">·</button>`).join('')}`).join('')}</div><small>왼쪽 / 오른쪽</small></div>`:''}
  ${q.kind==='order'?`<div class="deduct-order-visual">${Array.from({length:6},(_,i)=>`<div><small>${i+1}</small><b>?</b></div>`).join('')}</div>`:''}
  ${q.clues.length?`<div class="deduct-clues"><strong>조건</strong>${q.clues.map((c,i)=>`<p>${escapeHtml(c)}</p>`).join('')}</div>`:''}
  <div class="reason-choices deduct-choices">${q.options.map((v,i)=>`<button class="reason-choice" type="button" data-deduct-choice="${i}"><span class="reason-choice-number">${DEDUCT_NUM[i]}</span><span>${escapeHtml(v)}</span></button>`).join('')}</div>
  <div class="feedback reason-feedback" id="answer-feedback" aria-live="polite"></div>
  </section>`;
}
function mountDeductionQuestion(q,{root,submit}){
 $$('[data-deduct-choice]',root).forEach(b=>b.addEventListener('click',()=>submit(Number(b.dataset.deductChoice),b)));
 if(q.kind!=='seat')return;
 let chosen='',map=Array(8).fill('');
 $$('[data-seat-person]',root).forEach(b=>b.addEventListener('click',()=>{
  chosen=b.dataset.seatPerson;$$('[data-seat-person]',root).forEach(x=>x.classList.toggle('selected',x===b));
 }));
 $$('[data-seat-cell]',root).forEach(b=>b.addEventListener('click',()=>{
  const i=Number(b.dataset.seatCell);
  if(chosen)map=map.map(x=>x===chosen?'':x);
  map[i]=map[i]===chosen?'':chosen;
  $$('[data-seat-cell]',root).forEach(c=>{const v=map[Number(c.dataset.seatCell)];c.textContent=v||'·';c.classList.toggle('occupied',!!v);});
 }));
}
registerMode({key:'deduction',title:'조건 · 논리 추리',subtitle:'좌석 배치, 순서, 참·거짓, 명제, 확률을 연습합니다.',tag:'REASONING / LOGIC',art:'A→?',
 makeQuestion:makeDeductionQuestion,render:renderDeductionQuestion,mount:mountDeductionQuestion,
 checkAnswer(q,v){return {correct:Number(v)===q.correctIndex,explanation:q.explanation};}});
