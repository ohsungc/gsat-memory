'use strict';
// Alphabet memory and speed drill. The mobile keypad never opens the OS keyboard.
registerMode({
  key:'alphabet', title:'알파벳 번호',
  subtitle:'A=1부터 Z=26까지 즉시 변환. 숫자를 직접 입력하세요.',
  tag:'LETTER → NUMBER', art:'A↔26',
  makeQuestion({session}){
    const n=balancedPick(Array.from({length:26},(_,i)=>i+1),'alphabet:letter');
    session.lastQuestionSignature=n;
    return {n,answer:n,answerText:`${letter(n)} = ${n}`};
  },
  render(q){
    const digits=Array.from({length:9},(_,i)=>`<button type="button" class="alphabet-key" data-digit="${i+1}" aria-label="숫자 ${i+1}">${i+1}</button>`).join('');
    return `<section class="question-card alphabet-question"><div class="question-label">POSITION OF LETTER</div>
      <div class="big-question">${letter(q.n)}</div>
      <div class="question-instruction">이 알파벳은 몇 번째일까요?</div>
      <form class="answer-form alphabet-answer-form" id="answer-form">
        <input class="answer-input alphabet-answer-input" id="answer-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" placeholder="1~26" aria-label="알파벳 순서 번호">
        <button class="primary-btn alphabet-keyboard-submit" type="submit">확인 ↗</button>
      </form>
      <div class="alphabet-keypad" id="alphabet-keypad" role="group" aria-label="알파벳 번호 입력용 숫자 키패드">
        ${digits}
        <button type="button" class="alphabet-key alphabet-key-edit" data-action="backspace" aria-label="마지막 숫자 지우기">⌫</button>
        <button type="button" class="alphabet-key" data-digit="0" aria-label="숫자 0">0</button>
        <button type="button" class="alphabet-key alphabet-key-confirm" data-action="submit" aria-label="정답 제출">확인</button>
      </div>
      <div class="feedback" id="answer-feedback" aria-live="polite"></div>
    </section><div class="shortcut-note alphabet-desktop-hint">A=1 · M=13 · Z=26 | Enter로도 정답 제출</div>`;
  },
  mount(q,{root,submit}){
    const form=$('#answer-form',root);
    const input=$('#answer-input',root);
    const keypad=$('#alphabet-keypad',root);
    const desktopSubmit=$('.alphabet-keyboard-submit',root);
    const isMobile=window.matchMedia('(max-width: 720px)').matches;
    if(isMobile){
      input.readOnly=true; // no native mobile keyboard; all digits go through in-game buttons
      input.setAttribute('inputmode','none');
      input.setAttribute('aria-description','아래 숫자 키패드에서 번호를 입력하세요');
    }
    const send=(origin)=>{
      const raw=input.value.trim();
      if(!/^\d{1,2}$/.test(raw))return;
      submit(Number(raw),origin);
    };
    form.addEventListener('submit',e=>{e.preventDefault();send(desktopSubmit);});
    input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,2);});
    keypad.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(!btn||btn.disabled)return;
      if(btn.dataset.digit!==undefined){
        const digit=btn.dataset.digit;
        input.value=input.value.length>=2?digit:input.value+digit;
      }else if(btn.dataset.action==='backspace'){
        input.value=input.value.slice(0,-1);
      }else if(btn.dataset.action==='submit'){
        send(btn);
      }
    });
  },
  checkAnswer(q,value){return Number(value)===q.n;}
});
