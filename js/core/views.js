'use strict';
  function topbar(){
    return `<header class="topbar">
      <div class="logo" id="logo-home" role="button" tabindex="0" aria-label="홈으로">
        <span class="logo-mark">G.</span><span class="logo-words"><strong>GSAT 단순암기</strong><small>QUICK PRACTICE</small></span>
      </div>
      <div class="top-actions"><button class="icon-btn" id="monitor-btn" aria-label="오답 모니터링" title="오답 모니터링">▤</button><button class="icon-btn" id="sound-btn" aria-label="소리 켜기 또는 끄기" title="소리">${state.settings.sound?'♫':'♪̸'}</button><button class="icon-btn" id="settings-btn" aria-label="설정" title="설정">⚙</button></div>
    </header>`;
  }
  function bindTopbar(){
    $('#logo-home')?.addEventListener('click',exitGame);
    $('#logo-home')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();exitGame();}});
    $('#settings-btn')?.addEventListener('click',showSettings);
    $('#monitor-btn')?.addEventListener('click',renderMonitor);
    $('#sound-btn')?.addEventListener('click',()=>{state.settings.sound=!state.settings.sound;saveState();const b=$('#sound-btn');if(b)b.textContent=state.settings.sound?'♫':'♪̸';toast(state.settings.sound?'효과음 켜짐':'효과음 꺼짐');});
  }
  function exitGame(){
    stopFeverTimer();clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    session=null;currentMode=null;question=null;studyMode=null;monitoring=false;selectedCell=null;renderHome();
  }
  function renderHome(){
    scratchpadHide();
    stopParticles();
    monitoring=false;
    const visibleModes=[...modeRegistry.values()].filter(m=>!m.hidden);
    const total=state.totalAnswered;
    const acc=total?Math.round(100*state.totalRight/total):0;
    app.innerHTML=`${topbar()}
      <main>
        <section class="hero"><div class="eyebrow">GSAT / PRACTICE</div><h1>GSAT 단순암기</h1><p>암기·암산·자료 탐색·집합·도식·조건 추론을 반복합니다. 기록을 분석해 자주 틀린 문제를 다시 연습하세요.</p></section>
        <section class="stats-grid" aria-label="누적 통계"><div class="stat"><b>${two(total)}</b><span>누적 풀이</span></div><div class="stat"><b>${acc}%</b><span>전체 정답률</span></div><div class="stat"><b>${two(state.bestCombo)}</b><span>최고 콤보</span></div></section>
        <button type="button" id="open-monitor" class="monitor-banner"><span><strong>오답 모니터링</strong><small>유형별 정답률 · 다시 풀 문제 · 취약 문제 집중 연습</small></span><span class="monitor-count">${getWeakEntries().length}개 복습 대기 →</span></button>
        <div class="fever-overview"><div><strong>FEVER 챌린지</strong><small>각 문제 카드의 FEVER 버튼으로 시작 · 제한시간 · 3번 실수 시 종료</small></div><div><span class="fever-kicker">최고 기록</span><div class="score-best">${two(Math.max(0,...Object.values(state.feverBest).map(Number)))}</div></div></div>
        <div class="section-header"><h2>트레이닝 선택</h2><span>${visibleModes.length.toString().padStart(2,'0')} MODES</span></div>
        <div class="mode-grid">${visibleModes.map((m,i)=>`<article class="mode-card" aria-label="${escapeHtml(m.title)}">
        <span class="mode-index">${String(i+1).padStart(2,'0')}</span><span class="mode-art" aria-hidden="true">${escapeHtml(m.art||'◇')}</span><span class="mode-title">${escapeHtml(m.title)}</span><span class="mode-sub">${escapeHtml(m.subtitle||'')}</span><span class="mode-foot"><span>${escapeHtml(m.tag||'SPEED DRILL')}</span></span>
        <div class="mode-actions ${m.key==='reason'?'logic-actions':''}">${m.key==='reason'?`<button type="button" class="secondary-btn mode-study" data-study="reason">개념 암기</button><button type="button" class="secondary-btn mode-diagram" data-start="diagram">다이어그램 퀴즈</button><button type="button" class="primary-btn mode-play" data-start="reason">명제 추론 →</button><button type="button" class="mode-fever" data-fever="reason">FEVER ⚡</button>`:`${['alphabet','fraction'].includes(m.key)?`<button type="button" class="secondary-btn mode-study" data-study="${escapeHtml(m.key)}">암기하기</button>`:''}<button type="button" class="primary-btn mode-play" data-start="${escapeHtml(m.key)}">문제 풀기 →</button><button type="button" class="mode-fever" data-fever="${escapeHtml(m.key)}">FEVER ⚡</button>`}</div>
      </article>`).join('')}</div>
        <p class="footnote">비공식 개인 학습용 게임 · 삼성 및 GSAT 운영기관과 무관 · 기록은 현재 브라우저에만 저장됩니다.</p>
      </main>`;
    bindTopbar();
    $$('[data-start]').forEach(b=>b.addEventListener('click',()=>startGame(b.dataset.start)));
    $$('[data-fever]').forEach(b=>b.addEventListener('click',()=>renderFeverIntro(b.dataset.fever)));
    $('#open-monitor')?.addEventListener('click',renderMonitor);
    $$('[data-study]').forEach(b=>b.addEventListener('click',()=>renderStudy(b.dataset.study)));
  }
  // Unscored reference / hide-and-reveal study sheets for the two memorization modes.
  function renderStudy(key){
    scratchpadHide();
    if(key==='reason'){renderDiagramStudy();return;}
    if(!['alphabet','fraction'].includes(key))return;
    tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);
    stopFeverTimer();session=null;currentMode=null;question=null;studyMode=key;
    const isLetter=key==='alphabet';
    const entries=isLetter?Array.from({length:26},(_,i)=>({front:letter(i+1),back:String(i+1)})):
      Array.from({length:19},(_,i)=>({front:`1/${i+2}`,back:`${fixed2(100/(i+2))}%`}));
    app.innerHTML=`${topbar()}
      <div class="game-head"><button class="back-btn" id="study-back">← 훈련 선택</button><span class="game-caption">STUDY / NO TIMER</span></div>
      <div class="study-header"><div class="eyebrow">MEMORIZE FIRST</div><h1>${isLetter?'알파벳 번호 암기':'분수 비율표 암기'}</h1><p>${isLetter?'A=1부터 Z=26까지 순서를 눈으로 익히세요.':'1/2부터 1/20까지 자주 사용하는 백분율을 익히세요.'}</p></div>
      <div class="study-toolbar"><button class="study-toggle selected" id="reveal-all">전체 보기</button><button class="study-toggle" id="hide-all">가리고 외우기</button><button class="primary-btn study-play" id="study-play">문제 풀기 →</button></div>
      <div class="study-grid ${isLetter?'alphabet-grid':'fraction-grid'}">${entries.map(({front,back})=>`<button class="study-item" type="button" data-front="${escapeHtml(front)}" data-back="${escapeHtml(back)}" aria-label="${escapeHtml(front)}: ${escapeHtml(back)}"><span class="study-front">${escapeHtml(front)}</span><span class="study-back">${escapeHtml(back)}</span></button>`).join('')}</div>
      <div class="study-footnote">가리고 외우기에서는 각 칸을 누르면 정답이 나타납니다. 암기 화면에서는 점수와 시간이 기록되지 않습니다.</div>`;
    bindTopbar();
    $('#study-back').addEventListener('click',exitGame);
    $('#study-play').addEventListener('click',()=>startGame(key));
    const items=$$('.study-item');
    const showAll=shown=>{
      items.forEach(el=>{el.classList.toggle('masked',!shown);el.classList.remove('revealed');el.setAttribute('aria-pressed',String(shown));});
      $('#reveal-all').classList.toggle('selected',shown);
      $('#hide-all').classList.toggle('selected',!shown);
    };
    $('#reveal-all').addEventListener('click',()=>showAll(true));
    $('#hide-all').addEventListener('click',()=>showAll(false));
    items.forEach(el=>el.addEventListener('click',()=>{
      if(el.classList.contains('masked')){el.classList.toggle('revealed');el.setAttribute('aria-pressed',String(el.classList.contains('revealed')));}
    }));
  }

  function showSettings(){
    if($('.overlay'))return;
    if(session?.fever){toast('FEVER 도중에는 설정을 변경할 수 없습니다.');return;}
    const overlay=document.createElement('div');overlay.className='overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.innerHTML=`<div class="modal"><h2>게임 설정</h2><p>선택지를 이용하면 빠른 반복 학습에, 직접 입력하면 더 정확한 암기 확인에 적합합니다. 표 탐색에서는 선지에 필요한 분자·분모를 찾습니다. 집합 추론은 참인 결론 또는 결론을 완성할 중간 명제를 고릅니다.</p>
    <label class="setting-row"><span>한 세트 문제 수</span><select id="question-count"><option value="10">10문제</option><option value="20">20문제</option><option value="30">30문제</option></select></label>
    <label class="setting-row"><span>알파벳 번호 문제 방향</span><select id="alphabet-direction"><option value="mixed">혼합 (알파벳 ↔ 숫자)</option><option value="forward">알파벳 → 숫자</option><option value="reverse">숫자 → 알파벳</option></select></label>
    <label class="setting-row"><span>나누기 난이도</span><select id="division-level"><option value="basic">기본 (나눗셈표)</option><option value="advanced">심화 (두 자리 나눗수)</option><option value="mixed">혼합 출제</option></select></label>
    <label class="setting-row"><span>수치형 문제 정답 방식</span><select id="answer-style"><option value="choice">4지선다 (빠른 반복)</option><option value="input">직접 입력 (암기 확인)</option></select></label>
    <label class="setting-row"><span>표 자료 유형</span><select id="table-preset"><option value="mixed">혼합 출제</option><option value="finance">기업 재무 현황</option><option value="industry">산업군별 지수</option><option value="monthly">월별 민원 현황</option><option value="kindergarten">유치원 현황</option></select></label>
    <label class="setting-row"><span>표 탐색 선지 수</span><select id="table-options"><option value="2">2개</option><option value="3">3개</option><option value="4">4개</option></select></label>
    <label class="setting-row"><span>집합 추론 문제 유형</span><select id="reasoning-style"><option value="mixed">혼합 출제</option><option value="conclusion">참인 결론 찾기</option><option value="bridge">중간 다리 명제 찾기</option></select></label>
    <label class="setting-row"><span>조건·논리 문제 유형</span><select id="deduction-style"><option value="mixed">혼합 출제</option><option value="seat">2열×4행 좌석 배치</option><option value="order">도착 순서</option><option value="truth">참말 · 거짓말</option><option value="proposition">논리 명제</option><option value="probability">확률 · 경우의 수</option></select></label>
    <label class="setting-row"><span>효과음</span><input id="setting-sound" type="checkbox"></label>
    <label class="setting-row"><span>진동 피드백 (지원 기기)</span><input id="setting-haptics" type="checkbox"></label>
    <div class="modal-footer"><button class="primary-btn" id="close-settings">설정 저장</button></div></div>`;
    document.body.appendChild(overlay);
    $('#question-count',overlay).value=String(state.settings.questionCount);
    $('#alphabet-direction',overlay).value=state.settings.alphabetDirection||'mixed';
    $('#answer-style',overlay).value=state.settings.answerStyle;
    $('#division-level',overlay).value=state.settings.divisionLevel||'mixed';
    $('#table-preset',overlay).value=state.settings.tablePreset;
    $('#table-options',overlay).value=String(state.settings.tableOptions||2);
    $('#reasoning-style',overlay).value=state.settings.reasoningStyle||'mixed';
    $('#deduction-style',overlay).value=state.settings.deductionStyle||'mixed';
    $('#setting-sound',overlay).checked=state.settings.sound;
    $('#setting-haptics',overlay).checked=state.settings.haptics;
    const close=()=>{
      state.settings.questionCount=Number($('#question-count',overlay).value);
      state.settings.alphabetDirection=$('#alphabet-direction',overlay).value;
      state.settings.answerStyle=$('#answer-style',overlay).value;
      state.settings.divisionLevel=$('#division-level',overlay).value;
      state.settings.tablePreset=$('#table-preset',overlay).value;
      state.settings.tableOptions=Number($('#table-options',overlay).value);
      state.settings.reasoningStyle=$('#reasoning-style',overlay).value;
      state.settings.deductionStyle=$('#deduction-style',overlay).value;
      state.settings.sound=$('#setting-sound',overlay).checked;
      state.settings.haptics=$('#setting-haptics',overlay).checked;
      saveState();overlay.remove();
      if(session)renderQuestion();else if(studyMode)renderStudy(studyMode);else if(monitoring)renderMonitor();else renderHome();
    };
    $('#close-settings',overlay).addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    $('#close-settings',overlay).focus();
  }
