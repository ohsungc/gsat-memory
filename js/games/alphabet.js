'use strict';
// A→1 / 1→A, with an optional balanced mix of both directions.
// Legacy snapshots (without direction) remain valid as letter→number questions.
registerMode({
  key:'alphabet', title:'알파벳 번호',
  subtitle:'알파벳 ↔ 숫자를 양방향으로 변환합니다. 방향별 또는 혼합 훈련.',
  tag:'LETTER ↔ NUMBER', art:'A↔1',
  makeQuestion({session, state}){
    const option=state.settings.alphabetDirection||'mixed';
    const direction=option==='forward'||option==='reverse'?option:balancedPick(['forward','reverse'],'alphabet:direction');
    const n=balancedPick(Array.from({length:26},(_,i)=>i+1),direction==='forward'?'alphabet:letter':'alphabet:number');
    session.lastQuestionSignature=`${direction}:${n}`;
    return {n,direction,answer:direction==='forward'?n:letter(n),answerText:`${letter(n)} = ${n}`};
  },
  render(q){
    const reverse=q.direction==='reverse';
    const keys=reverse?Array.from({length:26},(_,i)=>letter(i+1)):Array.from({length:10},(_,i)=>String(i+1===10?0:i+1));
    const buttons=keys.map(k=>`<button type="button" class="alphabet-key" ${reverse?`data-letter="${k}" aria-label="알파벳 ${k}"`:`data-digit="${k}" aria-label="숫자 ${k}"`}>${k}</button>`);
    // 7 × 4 alphabet layout; the ordinary numeric layout stays 3 × 4.
    if(!reverse){
      buttons.splice(9,0,`<button type="button" class="alphabet-key alphabet-key-edit" data-action="backspace" aria-label="마지막 숫자 지우기">⌫</button>`);
      buttons.push(`<button type="button" class="alphabet-key alphabet-key-confirm" data-action="submit" aria-label="정답 제출">확인</button>`);
    }else{
      buttons.push(`<button type="button" class="alphabet-key alphabet-key-edit" data-action="backspace" aria-label="입력 지우기">⌫</button>`);
      buttons.push(`<button type="button" class="alphabet-key alphabet-key-confirm" data-action="submit" aria-label="정답 제출">확인</button>`);
    }
    return `<section class="question-card alphabet-question"><div class="question-label">${reverse?'LETTER FROM NUMBER':'POSITION OF LETTER'}</div>
      <div class="big-question">${reverse?q.n:letter(q.n)}</div>
      <div class="question-instruction">${reverse?'이 숫자에 해당하는 알파벳은?':'이 알파벳은 몇 번째일까요?'}</div>
      <form class="answer-form alphabet-answer-form" id="answer-form">
        <input class="answer-input alphabet-answer-input" id="answer-input" type="text" inputmode="${reverse?'text':'numeric'}" maxlength="${reverse?1:2}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${reverse?'A~Z':'1~26'}" aria-label="${reverse?'숫자에 해당하는 알파벳':'알파벳 순서 번호'}">
        <button class="primary-btn alphabet-keyboard-submit" type="submit">확인 ↗</button>
      </form>
      <div class="alphabet-keypad ${reverse?'alphabet-keypad--letters':''}" id="alphabet-keypad" role="group" aria-label="${reverse?'알파벳 입력 키패드':'숫자 입력 키패드'}">
        ${buttons.join('')}
      </div>
      <div class="feedback" id="answer-feedback" aria-live="polite"></div>
    </section><div class="shortcut-note alphabet-desktop-hint">A=1 · M=13 · Z=26 | Enter로도 정답 제출</div>`;
  },
  mount(q,{root,submit}){
    const form=$('#answer-form',root);
    const input=$('#answer-input',root);
    const keypad=$('#alphabet-keypad',root);
    const desktopSubmit=$('.alphabet-keyboard-submit',root);
    const reverse=q.direction==='reverse';
    const isMobile=window.matchMedia('(max-width: 720px)').matches;
    if(isMobile){
      input.readOnly=true;
      input.setAttribute('inputmode','none');
      input.setAttribute('aria-description',reverse?'아래 알파벳 키패드에서 입력하세요':'아래 숫자 키패드에서 입력하세요');
    }
    const normalized=()=>reverse?input.value.trim().toUpperCase():input.value.trim();
    const send=origin=>{
      const raw=normalized();
      if(reverse){
        if(!/^[A-Z]$/.test(raw))return;
        submit(raw,origin);
      }else{
        if(!/^\d{1,2}$/.test(raw))return;
        submit(Number(raw),origin);
      }
    };
    form.addEventListener('submit',e=>{e.preventDefault();send(desktopSubmit);});
    input.addEventListener('input',()=>{input.value=reverse?input.value.replace(/[^a-z]/ig,'').toUpperCase().slice(0,1):input.value.replace(/\D/g,'').slice(0,2);});
    keypad.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(!btn||btn.disabled)return;
      if(reverse && btn.dataset.letter){
        input.value=btn.dataset.letter;
      }else if(!reverse && btn.dataset.digit!==undefined){
        const digit=btn.dataset.digit;
        input.value=input.value.length>=2?digit:input.value+digit;
      }else if(btn.dataset.action==='backspace'){
        input.value=input.value.slice(0,-1);
      }else if(btn.dataset.action==='submit'){
        send(btn);
      }
    });
  },
  checkAnswer(q,value){return q.direction==='reverse'?String(value).trim().toUpperCase()===letter(q.n):Number(value)===q.n;}
});
