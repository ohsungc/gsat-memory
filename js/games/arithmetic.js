'use strict';
  // 4. Exact division practice. Two levels; answers always integer (no rounding trap).
  registerMode({key:'divide',title:'나누기',subtitle:'정확하게 나누어떨어지는 계산을 빠르게 암산합니다.',tag:'MENTAL MATH / DIVIDE',art:'÷',
    makeQuestion({session,state}){
      const level=state.settings.divisionLevel==='mixed'?pick(['basic','advanced']):state.settings.divisionLevel;
      let divisor,quotient,dividend,signature,tries=0;
      do{
        divisor=level==='basic'?random(2,12):random(11,25);
        quotient=level==='basic'?random(3,18):random(11,45);
        dividend=divisor*quotient;
        signature=`${dividend}/${divisor}`;
      }while(signature===session.lastQuestionSignature&&++tries<20);
      session.lastQuestionSignature=signature;
      return {dividend,divisor,answer:quotient,answerText:`${two(dividend)} ÷ ${divisor} = ${quotient}`,level};
    },
    render(q){return `<section class="question-card"><div class="question-label">DIVISION / ${q.level==='basic'?'BASIC':'ADVANCED'}</div><div class="math-equation">${two(q.dividend)} <span>÷</span> ${q.divisor}</div><div class="question-instruction">몫을 입력하세요. (나머지 없음)</div><form class="answer-form" id="answer-form"><input class="answer-input" id="answer-input" type="number" inputmode="numeric" min="0" step="1" autocomplete="off" placeholder="정답" aria-label="나누기 몫"><button type="submit" class="primary-btn">확인 ↗</button></form><div class="feedback" id="answer-feedback"></div></section><div class="shortcut-note">난이도는 설정에서 변경할 수 있습니다.</div>`;},
    mount(q,{root,submit}){$('#answer-form',root).addEventListener('submit',e=>{e.preventDefault();const el=$('#answer-input',root);if(el.value.trim()!=='')submit(Number(el.value),$('button[type=submit]',root));});},
    checkAnswer(q,value){return Number(value)===q.answer;}
  });

  function numericChoices(correct, count=4){
    const candidates=new Set([correct]);
    const tweaks=[-25,-20,-15,-10,-5,-3,-2,-1,1,2,3,5,10,15,20,25];
    const base=Math.max(1,Math.round(correct*.1));
    for(const t of shuffle(tweaks)){
      const v=correct+t*(correct>150?base:1);
      if(v>0 && Number.isInteger(v) && v!==correct)candidates.add(v);
      if(candidates.size>=count)break;
    }
    let i=1;while(candidates.size<count){candidates.add(correct+i*7);i++;}
    return shuffle([...candidates].slice(0,count));
  }
  // 5. Reverse percentage: "part is p% of total" => find the total.
  registerMode({key:'reversePercent',title:'백분율 역산',subtitle:'전체의 15%가 54일 때 원래 전체가 얼마인지 구합니다.',tag:'RATIO / REVERSE',art:'15%',
    makeQuestion({session}){
      const percentages=[2.5,5,7.5,10,12.5,15,17.5,20,25,30,35,37.5,40,45,50,60,75,80];
      let percent,total,part,sig,tries=0;
      do{
        percent=pick(percentages);total=random(2,60)*40;part=total*percent/100;
        sig=`${percent}:${part}`;
      }while(sig===session.lastQuestionSignature&&++tries<15);
      session.lastQuestionSignature=sig;
      return {percent,total,part,choices:numericChoices(total),answerText:`${two(part)} ÷ (${percent}/100) = ${two(total)}`};
    },
    render(q,{settings}){
      const choice=settings.answerStyle==='choice';
      return `<section class="question-card"><div class="question-label">REVERSE PERCENTAGE</div><div class="reverse-percent-brief"><span>전체의</span><strong>${q.percent}%</strong><span>가</span><strong>${two(q.part)}</strong><span>입니다.</span></div><div class="question-instruction">전체 값은 얼마일까요?</div>${choice?`<div class="choice-grid">${q.choices.map(c=>`<button type="button" class="choice" data-choice="${c}">${two(c)}</button>`).join('')}</div>`:`<form class="answer-form" id="answer-form"><input class="answer-input" id="answer-input" type="number" inputmode="numeric" step="1" autocomplete="off" placeholder="전체 값" aria-label="전체 값"><button class="primary-btn" type="submit">확인 ↗</button></form>`}<div class="feedback" id="answer-feedback"></div></section>`;
    },
    mount(q,{root,submit}){mountFractionQuestion(q,{root,submit});},
    checkAnswer(q,value){return Number(value)===q.total;}
  });

  // 6. Compare rational values using exact integer cross products (no rounding errors).
  function gcd(a,b){while(b){[a,b]=[b,a%b];}return a;}
  registerMode({key:'fractionCompare',title:'분수 크기 비교',subtitle:'통분 없이 교차곱으로 어느 분수가 더 큰지 판단합니다.',tag:'FRACTION / COMPARE',art:'> <',
    makeQuestion({session}){
      let a,b,c,d,ans,signature,tries=0;
      const equalMode=Math.random()<.16;
      do{
        b=random(3,20);a=random(1,b-1);
        if(equalMode){
          const g=gcd(a,b),reducedA=a/g,reducedB=b/g;
          const possibilities=[];
          for(let factor=1;reducedB*factor<=20;factor++){
            if(reducedB*factor===b && reducedA*factor===a)continue;
            possibilities.push([reducedA*factor,reducedB*factor]);
          }
          if(!possibilities.length)continue;
          [c,d]=pick(possibilities);
        }else{
          d=random(3,20);c=random(1,d-1);
          if(a*d===c*b)continue;
        }
        signature=`${a}/${b}|${c}/${d}`;
        if(signature!==session.lastQuestionSignature)break;
      }while(++tries<120);
      if(!signature || !b || !d || !a || !c){a=2;b=3;c=3;d=4;}
      session.lastQuestionSignature=`${a}/${b}|${c}/${d}`;
      ans=a*d===c*b?'=':a*d>c*b?'>':'<';
      return {a,b,c,d,answer:ans,answerText:`교차곱 ${a}×${d}=${a*d}, ${c}×${b}=${c*b} → ${ans}`};
    },
    render(q){return `<section class="question-card"><div class="question-label">COMPARE FRACTIONS</div><div class="compare-fractions"><div class="math-fraction"><strong>${q.a}</strong><i></i><strong>${q.b}</strong></div><span class="comparison-placeholder">?</span><div class="math-fraction"><strong>${q.c}</strong><i></i><strong>${q.d}</strong></div></div><div class="question-instruction">왼쪽 분수와 오른쪽 분수를 비교하세요.</div><div class="compare-choices"><button class="choice" data-compare="<" type="button">&lt;</button><button class="choice" data-compare="=" type="button">=</button><button class="choice" data-compare=">" type="button">&gt;</button></div><div class="feedback" id="answer-feedback"></div></section>`;},
    mount(q,{root,submit}){$$('[data-compare]',root).forEach(b=>b.addEventListener('click',()=>submit(b.dataset.compare,b)));},
    checkAnswer(q,value){return {correct:value===q.answer,explanation:q.answerText};}
  });
