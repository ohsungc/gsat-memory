'use strict';
  function startGame(key, reviewQueue=null, fever=false){
    const mode=modeRegistry.get(key);if(!mode)return;
    monitoring=false;
    stopFeverTimer();clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    currentMode=mode;
    session={mode:reviewQueue?'review':key,limit:fever?FEVER_MAX_QUESTIONS:(reviewQueue?reviewQueue.length:state.settings.questionCount),index:0,correct:0,combo:0,bestCombo:0,elapsed:0,locked:false,startTime:Date.now(),mistakes:0,lastQuestionSignature:null,review:!!reviewQueue,reviewQueue,fever:Boolean(fever&&!reviewQueue),score:0,lives:3,timeouts:0};
    nextQuestion();
  }
  function nextQuestion(){
    if(!session)return;
    stopFeverTimer();tableCleanup();tableCleanup=()=>{};selectedCell=null;
    if(session.index>=session.limit){if(session.fever)finishFever();else finishGame();return;}
    if(session.review){
      const item=session.reviewQueue[session.index];
      currentMode=modeRegistry.get(item.mode);
      question=JSON.parse(JSON.stringify(item.question));
      question._wrongKey=item.id;
      if(item.mode==='table'){
        question.errors=0;
        question.slots.forEach(slot=>slot.filled=false);
        question.options.forEach(opt=>opt.slots.forEach(slot=>slot.filled=false));
      }
    }else{
      question=currentMode.makeQuestion({session,state,random,pick,shuffle,balancedPick});
      // Save counts of *presented* questions across sessions, without touching the wrong-answer bank.
      saveState();
    }
    session.questionStarted=performance.now();session.locked=false;
    if(session.fever){session.allowed=feverAllowance(currentMode.key,session.combo,session.score);session.remaining=session.allowed;}
    renderQuestion();
  }
  function gameHeader(){
    const n=session.index+1,limit=session.limit;
    if(session.fever)return `${topbar()}<div class="game-head"><button class="back-btn" id="go-home">← 도전 종료</button><span class="game-caption">FEVER · ${n} / ${limit} QUESTION</span></div>${feverHeader()}`;
    return `${topbar()}<div class="game-head"><button class="back-btn" id="go-home">← 훈련 선택</button><span class="game-caption">${session.review?'오답 복습 · ':''}${n} / ${limit} QUESTION</span></div>
    <div class="game-banner"><div><div class="eyebrow">${escapeHtml(currentMode.tag||'SPEED DRILL')}</div><h1>${escapeHtml(currentMode.title)}</h1></div><div class="combo-chip ${session.combo>=2?'active':''}"><strong>${session.combo}</strong><small>COMBO</small></div></div>
    <div class="progress-track"><div class="progress-fill" style="width:${Math.round(100*session.index/limit)}%"></div></div>
    <div class="game-metrics"><span>정답 <b>${session.correct}</b> / ${session.index}</span><span>평균 ${session.index?(session.elapsed/session.index/1000).toFixed(1):'—'}초</span></div>`;
  }
  function renderQuestion(){
    if(!session||!question)return;
    stopParticles();
    tableCleanup();tableCleanup=()=>{};
    app.innerHTML=`${gameHeader()}<main id="question-content">${currentMode.render(question,{settings:state.settings,session})}</main>`;
    bindTopbar();$('#go-home')?.addEventListener('click',exitGame);
    currentMode.mount(question,{
root:$('#question-content'),submit:submitAnswer,toast,settings:state.settings,session});
    // On desktop, return keyboard focus to the newly-created answer field.
    // Enter submits a form, then the following question replaces the old input.
    // Without refocusing here, players must click the input again each round.
    // Keep mobile (touch/virtual-keyboard) behavior unchanged.
    const answerInput=$('#answer-input',app);
    if(answerInput && window.matchMedia('(min-width: 721px) and (pointer: fine)').matches){
      try{answerInput.focus({preventScroll:true});}
      catch{answerInput.focus();}
    }
    if(session?.fever){session.questionStarted=performance.now();startFeverClock();}
  }
  function submitAnswer(value,origin){
    if(!session||session.locked)return;
    if(session.fever&&session.remaining<=0){feverTimeout();return;}
    const result=currentMode.checkAnswer(question,value,{settings:state.settings,session});
    if(result===null)return;
    const correct=typeof result==='object'?Boolean(result.correct):Boolean(result);
    const explanation=typeof result==='object'?result.explanation:question.answerText;
    processCompletedAnswer(correct,explanation,origin,false);
  }
  function processCompletedAnswer(correct,explanation,origin,timedOut){
    if(!session||session.locked)return;
    const elapsed=timedOut&&session.fever?session.allowed*1000:performance.now()-session.questionStarted;
    stopFeverTimer();session.locked=true;
    session.elapsed+=elapsed;session.index++;state.totalAnswered++;
    recordAnswer(currentMode.key,question,correct,elapsed);
    const priorTier=session.fever?feverTier(session.score):0;
    let awarded=0;
    if(correct){
      state.totalRight++;session.correct++;session.combo++;
      session.bestCombo=Math.max(session.bestCombo,session.combo);
      state.bestCombo=Math.max(state.bestCombo,session.combo);
      if(session.fever){awarded=feverAward(elapsed);session.score+=awarded;}
      origin?.classList?.add('correct');
      feedback(true,session.fever?`+${two(awarded)}점 · ${explanation||''}`:explanation);
      successEffect(session.combo,origin||$('#fever-score'));
      playSuccess(session.combo);
      if(state.settings.haptics&&navigator.vibrate)navigator.vibrate(session.combo>=5?[25,30,35]:18);
      if(session.fever&&feverTier(session.score)>priorTier){
        const tag=FEVER_TIERS[feverTier(session.score)].name;
        toast(`${tag} 달성 · 다음 문제부터 제한시간이 더 빨리 감소합니다`);
        $('#fever-hud')?.classList.add('rising');
      }
    }else{
      session.combo=0;session.mistakes++;
      if(session.fever){session.lives--;if(timedOut)session.timeouts++;}
      origin?.classList?.add('wrong');
      feedback(false,timedOut?`시간 초과 · ${explanation||'다음에는 더 빠르게!'}`:explanation);
      playWrong();if(state.settings.haptics&&navigator.vibrate)navigator.vibrate([60,40,60]);
    }
    if(session.fever){
      const score=$('#fever-score'),lives=$('#fever-lives'),mult=$('#fever-mult'),level=$('#fever-level');
      if(score)score.textContent=two(session.score);
      if(lives){lives.innerHTML=[0,1,2].map(i=>`<span class="${i<session.lives?'':'spent'}">♥</span>`).join('');lives.setAttribute('aria-label',`남은 기회 ${session.lives}`);}
      if(mult){mult.textContent=`연속 ${session.combo} · x${feverMultiplier(session.combo,session.score).toFixed(2)}`;mult.classList.toggle('hot',session.combo>=3);}
      const tier=feverTier(session.score),next=FEVER_TIERS[tier+1];
      if(level)level.innerHTML=`${FEVER_TIERS[tier].name}<small>${next?`다음 단계 ${two(next.min)}점`:'최고 단계'}</small>`;
    }
    saveState();
    $$('#question-content button, #question-content input, #question-content select').forEach(el=>{el.disabled=true;});
    const delay=session.fever?(correct?510:1050):(correct?900:1750);
    const game=session;
    pendingTimer=setTimeout(()=>{
      if(session!==game)return;
      if(session.fever&&session.lives<=0)finishFever();else nextQuestion();
    },delay);
  }
  function feedback(correct,explanation){
    const el=$('#answer-feedback')||$('#table-feedback');if(!el)return;
    el.textContent=correct?'정답! '+(explanation||''):'오답 · '+(explanation||'');
    el.classList.remove('ok','no');el.classList.add(correct?'ok':'no');
  }
  function finishGame(){
    stopFeverTimer();tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);
    const result={mode:session.mode,date:new Date().toISOString(),limit:session.limit,correct:session.correct,avgSec:Number((session.elapsed/session.limit/1000).toFixed(2)),bestCombo:session.bestCombo};
    state.records.unshift(result);state.records=state.records.slice(0,100);saveState();
    const accuracy=Math.round(100*session.correct/session.limit);
    app.innerHTML=`${topbar()}<div class="session-finish"><div class="finish-kicker">SESSION COMPLETE</div><div class="finish-percent">${accuracy}%</div><div class="finish-title">${accuracy===100?'완벽한 한 세트':accuracy>=80?'안정적인 속도 훈련':accuracy>=50?'반복할수록 빨라집니다':'한 번 더 연습해 보세요'}</div>
    <div class="finish-grid"><div class="finish-stat"><b>${session.correct}/${session.limit}</b><span>정답</span></div><div class="finish-stat"><b>${result.avgSec.toFixed(1)}s</b><span>문제당 평균</span></div><div class="finish-stat"><b>${session.bestCombo}</b><span>최고 콤보</span></div></div>
    <div class="finish-actions"><button class="secondary-btn" id="finish-home">모드 선택</button><button class="secondary-btn" id="finish-monitor">오답 모니터링</button><button class="primary-btn" id="retry">${session.review?'남은 오답 다시 풀기 →':'같은 훈련 다시 하기 →'}</button></div></div>`;
    bindTopbar();$('#finish-home').addEventListener('click',exitGame);$('#retry').addEventListener('click',()=>session.review?startWrongReview('all'):startGame(result.mode));
    $('#finish-monitor').addEventListener('click',renderMonitor);
    if(session.review && !getWeakEntries().length){$('#retry').disabled=true;$('#retry').textContent='복습 완료';}
    if(accuracy>=90){successEffect(Math.max(session.bestCombo,8),$('.finish-percent'));playSuccess(7);}
  }
