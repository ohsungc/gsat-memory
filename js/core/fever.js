'use strict';
  // FEVER is a separate session type built on the existing question engines.
  // No virtual currency, network calls, or paid rewards; local score only.
  const FEVER_MAX_QUESTIONS=80;
  const FEVER_BASE_SECONDS={alphabet:9,fraction:13,applied:16,divide:15,reversePercent:19,fractionCompare:14,diagram:20,reason:34,table:105,scheme:35,deduction:45};
  // Early multipliers are deliberately small. Only sustained accuracy at high scores
  // earns substantial amplification; score-tier transitions speed up the time decay.
  const FEVER_TIERS=[
    {min:0,name:'START',base:22,speed:12,step:.025,cap:1.15,decay:.012,minTime:.68},
    {min:450,name:'RISING',base:27,speed:15,step:.055,cap:1.38,decay:.022,minTime:.58},
    {min:1200,name:'FEVER',base:35,speed:22,step:.12,cap:2.05,decay:.031,minTime:.46},
    {min:2800,name:'SUPER FEVER',base:46,speed:30,step:.23,cap:3.15,decay:.043,minTime:.35},
    {min:6000,name:'MAX FEVER',base:62,speed:42,step:.36,cap:5,decay:.053,minTime:.28}
  ];
  const feverTier=score=>{let level=0;for(let i=1;i<FEVER_TIERS.length;i++){if(score>=FEVER_TIERS[i].min)level=i;}return level;};
  function feverMultiplier(streak,score){
    const tier=FEVER_TIERS[feverTier(score)];
    const stacks=Math.max(0,Math.floor(streak/3));
    return Math.min(tier.cap,1+stacks*tier.step);
  }
  function feverAllowance(mode,streak,score){
    const tier=FEVER_TIERS[feverTier(score)];
    let baseline=FEVER_BASE_SECONDS[mode]||17;
    if(mode==='scheme')baseline=question?.part===0?78:31;
    if(mode==='deduction')baseline=({seat:85,order:56,truth:37,proposition:45,probability:38}[question?.kind]||45);
    return Math.max(2.8,Math.round(baseline*Math.max(tier.minTime,Math.pow(1-tier.decay,streak))*10)/10);
  }
  function stopFeverTimer(){if(feverRaf)cancelAnimationFrame(feverRaf);feverRaf=0;}
  function renderFeverIntro(key){
    scratchpadHide();
    const mode=modeRegistry.get(key);if(!mode)return;
    stopFeverTimer();clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    stopParticles();session=null;question=null;currentMode=null;studyMode=null;monitoring=false;
    const best=state.feverBest[key]||0;
    app.innerHTML=`${topbar()}<div class="game-head"><button class="back-btn" id="fever-back">← 훈련 선택</button><span class="game-caption">CHALLENGE / FEVER</span></div>
      <section class="fever-intro"><span class="fever-intro-mark">FEVER CHALLENGE</span><h1>${escapeHtml(mode.title)}</h1><p>처음에는 넉넉한 제한시간으로 시작합니다. 연속 정답을 쌓으면 점수가 상승하지만, 문제당 시간은 점점 짧아집니다. 점수 구간을 넘을 때마다 단축 속도와 연속 정답 배율이 함께 증가합니다.</p>
      <div class="fever-rules"><div class="fever-rule"><span>실패 조건</span><strong>오답 또는 시간 초과 총 3회</strong></div><div class="fever-rule"><span>FEVER 배율</span><strong>3연속 정답마다 한 단계 상승</strong></div><div class="fever-rule"><span>속도 보너스</span><strong>남은 시간이 많을수록 추가 점수</strong></div><div class="fever-rule"><span>상위 점수대</span><strong>더 큰 배율 · 더 빠른 시간 단축</strong></div><div class="fever-rule"><span>현재 최고 기록</span><strong>${two(best)}점</strong></div></div>
      <div class="fever-actions"><button class="secondary-btn" id="fever-cancel">돌아가기</button><button class="primary-btn" id="fever-begin">챌린지 시작 →</button></div><p class="fever-history">최대 ${FEVER_MAX_QUESTIONS}문제 · 오답은 기존 오답노트에도 저장 · 중도 종료 시 점수는 기록하지 않습니다.</p></section>`;
    bindTopbar();$('#fever-back').addEventListener('click',exitGame);$('#fever-cancel').addEventListener('click',exitGame);
    $('#fever-begin').addEventListener('click',()=>startGame(key,null,true));
  }
  function feverHeader(){
    const t=FEVER_TIERS[feverTier(session.score)];
    const next=FEVER_TIERS[feverTier(session.score)+1];
    const m=feverMultiplier(session.combo,session.score);
    return `<section class="fever-hud" id="fever-hud" aria-label="FEVER 경기 정보">
      <div class="fever-hud-top"><div class="fever-score-group"><span class="fever-kicker">FEVER SCORE</span><strong class="fever-score" id="fever-score">${two(session.score)}</strong></div>
      <div class="fever-level" id="fever-level">${escapeHtml(t.name)}<small>${next?`다음 단계 ${two(next.min)}점`:'최고 단계'}</small></div>
      <div class="fever-lives" id="fever-lives" aria-label="남은 기회 ${session.lives}">${[0,1,2].map(i=>`<span class="${i<session.lives?'':'spent'}">♥</span>`).join('')}</div></div>
      <div class="fever-hud-bottom"><div class="fever-timer" role="progressbar" aria-label="남은 시간" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100" id="fever-timer-track"><div class="fever-timer-fill" id="fever-timer-fill"></div></div><span class="fever-seconds" id="fever-time-label">${session.allowed.toFixed(1)}s</span></div>
      <div class="fever-foot"><span>문제 ${session.index+1} · 제한 ${session.allowed.toFixed(1)}초</span><span id="fever-mult" class="fever-mult ${session.combo>=3?'hot':''}">연속 ${session.combo} · x${m.toFixed(2)}</span></div>
    </section>`;
  }
  function startFeverClock(){
    stopFeverTimer();if(!session?.fever||session.locked)return;
    const parent=session;
    const deadline=performance.now()+session.allowed*1000;
    const fill=$('#fever-timer-fill'),label=$('#fever-time-label'),track=$('#fever-timer-track');
    const tick=()=>{
      if(!session||session!==parent||!session.fever||session.locked)return;
      const remaining=Math.max(0,(deadline-performance.now())/1000);
      const ratio=remaining/session.allowed;
      session.remaining=remaining;
      if(fill){fill.style.width=(ratio*100).toFixed(1)+'%';fill.classList.toggle('urgent',ratio<=.23);}
      if(label)label.textContent=remaining.toFixed(1)+'s';
      if(track)track.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
      if(remaining<=0){feverTimeout();return;}
      feverRaf=requestAnimationFrame(tick);
    };
    feverRaf=requestAnimationFrame(tick);
  }
  function feverTimeout(){
    if(!session?.fever||session.locked)return;
    // Record the actual question as an incorrect attempt and send it to review.
    processCompletedAnswer(false,question.answerText||'제한시간 종료',null,true);
  }
  function feverAward(elapsed){
    const tier=FEVER_TIERS[feverTier(session.score)];
    const remaining=Math.max(0,1-elapsed/(session.allowed*1000));
    const mult=feverMultiplier(session.combo,session.score);
    // Higher levels increase the value of speed; low levels stay conservative.
    return Math.max(1,Math.round((tier.base+tier.speed*remaining)*mult));
  }
  function finishFever(){
    scratchpadHide();
    if(!session?.fever)return;
    stopFeverTimer();tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);stopParticles();
    const s=session,record={mode:s.mode,date:new Date().toISOString(),score:s.score,correct:s.correct,attempts:s.index,bestCombo:s.bestCombo,timeouts:s.timeouts};
    state.feverBest[s.mode]=Math.max(state.feverBest[s.mode]||0,s.score);
    state.feverRecords.unshift(record);state.feverRecords=state.feverRecords.slice(0,80);saveState();
    const accuracy=s.index?Math.round(s.correct/s.index*100):0;
    app.innerHTML=`${topbar()}<section class="session-finish fever-results"><div class="finish-kicker">FEVER / CHALLENGE COMPLETE</div>
      <div class="finish-percent">${two(s.score)}</div><div class="finish-title">${escapeHtml(modeRegistry.get(s.mode)?.title||s.mode)} · 최고 ${two(state.feverBest[s.mode])}점</div>
      <div class="finish-grid"><div class="finish-stat"><b>${s.correct}/${s.index}</b><span>정답</span></div><div class="finish-stat"><b>${accuracy}%</b><span>정확도</span></div><div class="finish-stat"><b>${s.bestCombo}</b><span>최대 연속</span></div></div>
      <p class="fever-history">시간 초과 ${s.timeouts}회 · 같은 기기와 브라우저에서 최고 점수가 유지됩니다.</p>
      <div class="finish-actions"><button class="secondary-btn" id="fever-finish-home">모드 선택</button><button class="secondary-btn" id="fever-finish-monitor">오답 모니터링</button><button class="primary-btn" id="fever-retry">FEVER 다시 도전 →</button></div></section>`;
    bindTopbar();$('#fever-finish-home').addEventListener('click',exitGame);
    $('#fever-finish-monitor').addEventListener('click',renderMonitor);
    $('#fever-retry').addEventListener('click',()=>renderFeverIntro(s.mode));
    session=null;question=null;currentMode=null;
  }
