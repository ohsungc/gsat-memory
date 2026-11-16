'use strict';
  function makeFractionQuestion(applied,session){
    let den=applied?random(3,20):random(2,20);
    let num=applied?random(2,den-1):1;
    if(session.lastQuestionSignature===`${num}/${den}`){den=den===20?2:den+1;if(applied&&den<3)den=3;num=applied?Math.min(num,den-1):1;}
    session.lastQuestionSignature=`${num}/${den}`;
    const exact=percentage(num,den),answer=Number(exact.toFixed(2));
    const alternatives=new Set([answer.toFixed(2)]);
    const candidates=[percentage(num,den+1),percentage(num,Math.max(2,den-1)),percentage(Math.max(1,num-1),den),percentage(num+1,den),exact+5,exact-5,exact+2.5,exact-2.5,exact+10,exact-10];
    shuffle(candidates).forEach(v=>{if(alternatives.size>=4)return;const r=Number(Math.max(.01,Math.min(99.99,v)).toFixed(2));if(Math.abs(r-answer)>=.3)alternatives.add(r.toFixed(2));});
    while(alternatives.size<4){const v=Math.max(.01,Math.min(99.99,answer+(random(-12,12)*.75)));if(Math.abs(v-answer)>.3)alternatives.add(v.toFixed(2));}
    return {num,den,answer,answerText:`${num}/${den} = ${fixed2(exact)}%`,choices:shuffle([...alternatives].map(Number))};
  }
  function renderFractionQuestion(q,{settings}){
    const choice=settings.answerStyle==='choice';
    return `<section class="question-card"><div class="question-label">FRACTION → PERCENT</div><div class="fraction-question"><div class="fraction-numer">${q.num}</div><div class="fraction-line"></div><div class="fraction-denom">${q.den}</div></div><div class="question-instruction">백분율로 환산하면? ${choice?'정답을 선택하세요.':'퍼센트 숫자를 직접 입력하세요.'}</div>
    ${choice?`<div class="choice-grid">${q.choices.map(p=>`<button class="choice" data-choice="${p}">${fixed2(p)}%</button>`).join('')}</div>`:`<form class="answer-form" id="answer-form"><input class="answer-input" id="answer-input" type="number" inputmode="decimal" step="any" placeholder="예: 16.67" aria-label="퍼센트 숫자"><span class="answer-suffix">%</span><button class="primary-btn" type="submit">확인 ↗</button></form>`}<div class="feedback" id="answer-feedback"></div></section><div class="shortcut-note">${choice?'설정에서 직접 입력 모드로 변경 가능':'소수점 둘째 자리까지 허용 오차 ±0.11%p'}</div>`;
  }
  function mountFractionQuestion(q,{root,submit}){
    $$('.choice',root).forEach(b=>b.addEventListener('click',()=>submit(Number(b.dataset.choice),b)));
    $('#answer-form',root)?.addEventListener('submit',e=>{e.preventDefault();const raw=$('#answer-input',root).value;if(raw==='')return;submit(Number(raw),$('button[type=submit]',root));});
  }
  const fractionCheck=(q,value)=>Number.isFinite(Number(value))&&Math.abs(Number(value)-q.answer)<=.111;
  registerMode({key:'fraction',title:'분수 비율표',subtitle:'1/2~1/20을 백분율로 변환. 50%, 33.33% 등을 자동화하세요.',tag:'MEMORY / 1÷N',art:'1/20',
    makeQuestion:({session})=>makeFractionQuestion(false,session),render:renderFractionQuestion,mount:mountFractionQuestion,checkAnswer:fractionCheck});
  registerMode({key:'applied',title:'분수 응용',subtitle:'3/5, 7/12처럼 분자를 확장해 비율을 빠르게 계산합니다.',tag:'MENTAL MATH / N÷M',art:'3/5',
    makeQuestion:({session})=>makeFractionQuestion(true,session),render:renderFractionQuestion,mount:mountFractionQuestion,checkAnswer:fractionCheck});
