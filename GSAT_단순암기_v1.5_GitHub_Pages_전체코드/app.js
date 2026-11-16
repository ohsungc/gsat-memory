/* GSAT 단순암기 — no external frameworks or server required.
 * New training modes can be added via window.GSATLab.registerMode({...}).
 * See README.md and the registerMode call at the end of this file.
 */
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const app = $('#app');
  const fxCanvas = $('#fx');
  const fxCtx = fxCanvas.getContext('2d');
  const modeRegistry = new Map();
  const STORAGE_KEY = 'gsat-speed-lab-v1';
  const DEFAULT_SETTINGS = {questionCount:10, answerStyle:'choice', tablePreset:'mixed', tableOptions:2, reasoningStyle:'mixed', divisionLevel:'mixed', sound:true, haptics:true};
  const defaultData = () => ({ settings:{...DEFAULT_SETTINGS}, records:[], totalRight:0, totalAnswered:0, bestCombo:0, wrongBank:{}, modeStats:{} });
  let state = loadState();
  let session = null;
  let currentMode = null;
  let question = null;
  let pendingTimer = null;
  let tableCleanup = () => {};
  let audioContext = null;
  let particles = [], animating = false, canvasW=0, canvasH=0, fxRatio=1;
  let selectedCell = null;
  let toastTimer = null;
  let studyMode = null;
  let monitoring = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadState(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(!raw || typeof raw !== 'object') return defaultData();
      return {...defaultData(), ...raw,settings:{...DEFAULT_SETTINGS,...raw.settings},records:Array.isArray(raw.records)?raw.records:[],wrongBank:raw.wrongBank&&typeof raw.wrongBank==='object'?raw.wrongBank:{},modeStats:raw.modeStats&&typeof raw.modeStats==='object'?raw.modeStats:{}};
    } catch {return defaultData();}
  }
  function saveState(){try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}}
  function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}
  const random = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;
  function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=random(0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
  const two = n => Number(n).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const fixed2 = n => Number(n.toFixed(2)).toLocaleString('ko-KR',{maximumFractionDigits:2});
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const letter = n => String.fromCharCode(64+n);
  const percentage = (num,denom) => num/denom*100;

  function registerMode(m){
    if(!m || !m.key || !m.title || !m.makeQuestion || !m.render || !m.mount || !m.checkAnswer) throw Error('Incomplete mode definition');
    modeRegistry.set(m.key,m);
    if(!session && !studyMode && !monitoring) renderHome();
  }
  window.GSATLab={registerMode, listModes:()=>[...modeRegistry.keys()],version:'1.5.0'};

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
    clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    session=null;currentMode=null;question=null;studyMode=null;monitoring=false;selectedCell=null;renderHome();
  }
  function renderHome(){
    stopParticles();
    monitoring=false;
    const visibleModes=[...modeRegistry.values()].filter(m=>!m.hidden);
    const total=state.totalAnswered;
    const acc=total?Math.round(100*state.totalRight/total):0;
    app.innerHTML=`${topbar()}
      <main>
        <section class="hero"><div class="eyebrow">GSAT / PRACTICE</div><h1>GSAT 단순암기</h1><p>암기·암산·자료 탐색·집합 추론을 짧게 반복합니다. 기록을 분석해 자주 틀린 문제를 다시 연습하세요.</p></section>
        <section class="stats-grid" aria-label="누적 통계"><div class="stat"><b>${two(total)}</b><span>누적 풀이</span></div><div class="stat"><b>${acc}%</b><span>전체 정답률</span></div><div class="stat"><b>${two(state.bestCombo)}</b><span>최고 콤보</span></div></section>
        <button type="button" id="open-monitor" class="monitor-banner"><span><strong>오답 모니터링</strong><small>유형별 정답률 · 다시 풀 문제 · 취약 문제 집중 연습</small></span><span class="monitor-count">${getWeakEntries().length}개 복습 대기 →</span></button>
        <div class="section-header"><h2>트레이닝 선택</h2><span>${visibleModes.length.toString().padStart(2,'0')} MODES</span></div>
        <div class="mode-grid">${visibleModes.map((m,i)=>`<article class="mode-card" aria-label="${escapeHtml(m.title)}">
        <span class="mode-index">${String(i+1).padStart(2,'0')}</span><span class="mode-art" aria-hidden="true">${escapeHtml(m.art||'◇')}</span><span class="mode-title">${escapeHtml(m.title)}</span><span class="mode-sub">${escapeHtml(m.subtitle||'')}</span><span class="mode-foot"><span>${escapeHtml(m.tag||'SPEED DRILL')}</span></span>
        <div class="mode-actions ${m.key==='reason'?'logic-actions':''}">${m.key==='reason'?`<button type="button" class="secondary-btn mode-study" data-study="reason">개념 암기</button><button type="button" class="secondary-btn mode-diagram" data-start="diagram">다이어그램 퀴즈</button><button type="button" class="primary-btn mode-play" data-start="reason">명제 추론 →</button>`:`${['alphabet','fraction'].includes(m.key)?`<button type="button" class="secondary-btn mode-study" data-study="${escapeHtml(m.key)}">암기하기</button>`:''}<button type="button" class="primary-btn mode-play" data-start="${escapeHtml(m.key)}">문제 풀기 →</button>`}</div>
      </article>`).join('')}</div>
        <p class="footnote">비공식 개인 학습용 게임 · 삼성 및 GSAT 운영기관과 무관 · 기록은 현재 브라우저에만 저장됩니다.</p>
      </main>`;
    bindTopbar();
    $$('[data-start]').forEach(b=>b.addEventListener('click',()=>startGame(b.dataset.start)));
    $('#open-monitor')?.addEventListener('click',renderMonitor);
    $$('[data-study]').forEach(b=>b.addEventListener('click',()=>renderStudy(b.dataset.study)));
  }
  // Unscored reference / hide-and-reveal study sheets for the two memorization modes.
  function renderStudy(key){
    if(key==='reason'){renderDiagramStudy();return;}
    if(!['alphabet','fraction'].includes(key))return;
    tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);
    session=null;currentMode=null;question=null;studyMode=key;
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
    const overlay=document.createElement('div');overlay.className='overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.innerHTML=`<div class="modal"><h2>게임 설정</h2><p>선택지를 이용하면 빠른 반복 학습에, 직접 입력하면 더 정확한 암기 확인에 적합합니다. 표 탐색에서는 선지에 필요한 분자·분모를 찾습니다. 집합 추론은 참인 결론 또는 결론을 완성할 중간 명제를 고릅니다.</p>
    <label class="setting-row"><span>한 세트 문제 수</span><select id="question-count"><option value="10">10문제</option><option value="20">20문제</option><option value="30">30문제</option></select></label>
    <label class="setting-row"><span>나누기 난이도</span><select id="division-level"><option value="basic">기본 (나눗셈표)</option><option value="advanced">심화 (두 자리 나눗수)</option><option value="mixed">혼합 출제</option></select></label>
    <label class="setting-row"><span>수치형 문제 정답 방식</span><select id="answer-style"><option value="choice">4지선다 (빠른 반복)</option><option value="input">직접 입력 (암기 확인)</option></select></label>
    <label class="setting-row"><span>표 자료 유형</span><select id="table-preset"><option value="mixed">혼합 출제</option><option value="finance">기업 재무 현황</option><option value="industry">산업군별 지수</option><option value="monthly">월별 민원 현황</option><option value="kindergarten">유치원 현황</option></select></label>
    <label class="setting-row"><span>표 탐색 선지 수</span><select id="table-options"><option value="2">2개</option><option value="3">3개</option><option value="4">4개</option></select></label>
    <label class="setting-row"><span>집합 추론 문제 유형</span><select id="reasoning-style"><option value="mixed">혼합 출제</option><option value="conclusion">참인 결론 찾기</option><option value="bridge">중간 다리 명제 찾기</option></select></label>
    <label class="setting-row"><span>효과음</span><input id="setting-sound" type="checkbox"></label>
    <label class="setting-row"><span>진동 피드백 (지원 기기)</span><input id="setting-haptics" type="checkbox"></label>
    <div class="modal-footer"><button class="primary-btn" id="close-settings">설정 저장</button></div></div>`;
    document.body.appendChild(overlay);
    $('#question-count',overlay).value=String(state.settings.questionCount);
    $('#answer-style',overlay).value=state.settings.answerStyle;
    $('#division-level',overlay).value=state.settings.divisionLevel||'mixed';
    $('#table-preset',overlay).value=state.settings.tablePreset;
    $('#table-options',overlay).value=String(state.settings.tableOptions||2);
    $('#reasoning-style',overlay).value=state.settings.reasoningStyle||'mixed';
    $('#setting-sound',overlay).checked=state.settings.sound;
    $('#setting-haptics',overlay).checked=state.settings.haptics;
    const close=()=>{
      state.settings.questionCount=Number($('#question-count',overlay).value);
      state.settings.answerStyle=$('#answer-style',overlay).value;
      state.settings.divisionLevel=$('#division-level',overlay).value;
      state.settings.tablePreset=$('#table-preset',overlay).value;
      state.settings.tableOptions=Number($('#table-options',overlay).value);
      state.settings.reasoningStyle=$('#reasoning-style',overlay).value;
      state.settings.sound=$('#setting-sound',overlay).checked;
      state.settings.haptics=$('#setting-haptics',overlay).checked;
      saveState();overlay.remove();
      if(session)renderQuestion();else if(studyMode)renderStudy(studyMode);else if(monitoring)renderMonitor();else renderHome();
    };
    $('#close-settings',overlay).addEventListener('click',close);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    $('#close-settings',overlay).focus();
  }

  // Local-only monitoring; previous v1 storage key is retained for seamless migration.
  // Bank keeps exact question snapshots for deterministic replay, including table/logic modes.
  function questionIdentity(mode,q){
    if(q._wrongKey)return q._wrongKey;
    let signature;
    if(mode==='alphabet')signature=`${q.n}`;
    else if(mode==='fraction'||mode==='applied')signature=`${q.num}/${q.den}`;
    else if(mode==='divide')signature=`${q.dividend}/${q.divisor}`;
    else if(mode==='reversePercent')signature=`${q.percent}:${q.part}`;
    else if(mode==='fractionCompare')signature=`${q.a}/${q.b}|${q.c}/${q.d}`;
    else if(mode==='diagram')signature=q.correctKey;
    else if(mode==='reason')signature=JSON.stringify({t:q.task,p:q.premises,c:q.conclusion});
    else if(mode==='table')signature=`${q.kind}:`+JSON.stringify(q.rows)+JSON.stringify(q.options.map(o=>o.text));
    else signature=JSON.stringify(q);
    return `${mode}|${signature}`;
  }
  function questionLabel(mode,q){
    if(mode==='alphabet')return `${letter(q.n)} = ?`;
    if(mode==='fraction'||mode==='applied')return `${q.num}/${q.den} = ?%`;
    if(mode==='divide')return `${q.dividend} ÷ ${q.divisor} = ?`;
    if(mode==='reversePercent')return `${two(q.part)}은 전체의 ${q.percent}% · 전체는?`;
    if(mode==='fractionCompare')return `${q.a}/${q.b}  ?  ${q.c}/${q.d}`;
    if(mode==='diagram')return q.statement;
    if(mode==='reason')return `${q.task==='bridge'?'중간 명제':'결론'} · ${q.premises.map(reasonText).join(' ')}`;
    if(mode==='table')return `${q.preset.title} · ${q.numStatements}개 선지`;
    return modeRegistry.get(mode)?.title||mode;
  }
  function recordAnswer(mode,q,correct,elapsed){
    const stats=state.modeStats[mode]||{attempted:0,right:0,wrong:0,totalMs:0};
    stats.attempted++;stats.totalMs+=Math.max(0,elapsed);
    if(correct)stats.right++;else stats.wrong++;
    state.modeStats[mode]=stats;
    const key=questionIdentity(mode,q);
    const existing=state.wrongBank[key];
    if(correct){
      if(existing){
        existing.correctAfterWrong=(existing.correctAfterWrong||0)+1;
        existing.streak=(existing.streak||0)+1;
        if(existing.streak>=2)existing.mastered=true;
        existing.lastResult='correct';existing.updated=Date.now();
      }
    }else{
      // Never persist a recursive/DOM-containing object. Only plain data is saved.
      const copy=JSON.parse(JSON.stringify(q));delete copy._wrongKey;
      state.wrongBank[key]={...(existing||{}),id:key,mode,label:questionLabel(mode,q),question:copy,wrongCount:(existing?.wrongCount||0)+1,correctAfterWrong:existing?.correctAfterWrong||0,streak:0,mastered:false,lastResult:'wrong',updated:Date.now()};
    }
    const entries=Object.values(state.wrongBank);
    if(entries.length>125){
      entries.sort((a,b)=>Number(a.mastered)-Number(b.mastered)||a.updated-b.updated);
      for(const e of entries.slice(0,entries.length-125))delete state.wrongBank[e.id];
    }
  }
  function getWeakEntries(mode='all'){
    return Object.values(state.wrongBank).filter(e=>e && !e.mastered && modeRegistry.has(e.mode) && (mode==='all'||e.mode===mode)).sort((a,b)=>b.wrongCount-a.wrongCount||b.updated-a.updated);
  }
  function startWrongReview(mode='all'){
    const entries=getWeakEntries(mode);
    if(!entries.length){toast('복습할 오답이 없습니다.');return;}
    const queue=entries.slice(0,Math.max(1,state.settings.questionCount)).map(e=>({id:e.id,mode:e.mode,question:e.question}));
    startGame(queue[0].mode,queue);
  }
  function renderMonitor(){
    stopParticles();
    clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    monitoring=true;session=null;currentMode=null;question=null;studyMode=null;
    const modes=[...modeRegistry.values()];
    const unresolved=getWeakEntries();
    const mastered=Object.values(state.wrongBank).filter(e=>e.mastered).length;
    const totalWrong=modes.reduce((n,m)=>n+(state.modeStats[m.key]?.wrong||0),0);
    app.innerHTML=`${topbar()}
      <div class="game-head"><button class="back-btn" id="monitor-back">← 훈련 선택</button><span class="game-caption">LOCAL / PROGRESS</span></div>
      <div class="monitor-header"><div class="eyebrow">REVIEW / WEAK POINTS</div><h1>오답 모니터링</h1><p>틀렸던 문제를 보관하고, 정답을 연속 2회 맞히면 복습 완료로 표시합니다. 모든 기록은 이 브라우저에만 저장됩니다.</p></div>
      <div class="stats-grid monitor-stats"><div class="stat"><b>${two(totalWrong)}</b><span>누적 오답 횟수</span></div><div class="stat"><b>${unresolved.length}</b><span>복습 대기 문제</span></div><div class="stat"><b>${mastered}</b><span>복습 완료 문제</span></div></div>
      <div class="monitor-toolbar"><button type="button" id="review-all" class="primary-btn" ${unresolved.length?'':'disabled'}>오답 집중 훈련 (${Math.min(unresolved.length,state.settings.questionCount)}문제) →</button><span class="monitor-help">틀린 문제를 그대로 다시 출제합니다.</span></div>
      <h2 class="monitor-heading">게임별 훈련 기록</h2>
      <div class="mode-stat-list">${modes.map(m=>{
        const s=state.modeStats[m.key]||{attempted:0,right:0,wrong:0,totalMs:0};
        const rate=s.attempted?Math.round(s.right/s.attempted*100):null;
        const waiting=getWeakEntries(m.key).length;
        return `<div class="mode-stat-row"><div class="mode-stat-name"><strong>${escapeHtml(m.title)}</strong><small>${s.attempted}회 풀이 · 오답 ${s.wrong}회 · 평균 ${s.attempted?(s.totalMs/s.attempted/1000).toFixed(1)+'초':'—'}</small></div><div class="stat-rate"><strong>${rate===null?'—':rate+'%'}</strong><small>정답률</small></div><button type="button" data-review-mode="${escapeHtml(m.key)}" class="secondary-btn stat-review" ${waiting?'':'disabled'}>복습 ${waiting}</button></div>`;
      }).join('')}</div>
      <div class="monitor-list-head"><h2 class="monitor-heading">오답 목록</h2><label>유형 <select id="monitor-filter"><option value="all">전체</option>${modes.map(m=>`<option value="${escapeHtml(m.key)}">${escapeHtml(m.title)}</option>`).join('')}</select></label></div>
      <div id="monitor-items"></div>
      <div class="monitor-footer"><button class="secondary-btn" id="clear-weak">오답 기록만 초기화</button><p>기록을 초기화해도 누적 풀이 및 게임별 정답률은 유지됩니다. 브라우저 데이터 삭제 또는 기기 변경 시 기록은 이전되지 않습니다.</p></div>`;
    bindTopbar();
    $('#monitor-back').addEventListener('click',exitGame);
    $('#review-all').addEventListener('click',()=>startWrongReview('all'));
    $$('[data-review-mode]').forEach(b=>b.addEventListener('click',()=>startWrongReview(b.dataset.reviewMode)));
    const showList=()=>{
      const filter=$('#monitor-filter').value;
      const list=getWeakEntries(filter);
      $('#monitor-items').innerHTML=list.length?list.slice(0,60).map(e=>`<div class="wrong-list-item"><div><small>${escapeHtml(modeRegistry.get(e.mode)?.title||e.mode)} · ${new Date(e.updated).toLocaleDateString('ko-KR')}</small><strong>${escapeHtml(e.label)}</strong></div><span class="wrong-badge">오답 ${e.wrongCount}회 · 재정답 ${e.streak}/2</span></div>`).join(''):`<div class="monitor-empty">${filter==='all'?'복습 대기 중인 오답이 없습니다.':'이 유형에 복습할 오답이 없습니다.'}</div>`;
    };
    $('#monitor-filter').addEventListener('change',showList);showList();
    $('#clear-weak').addEventListener('click',()=>{
      if(!Object.keys(state.wrongBank).length){toast('저장된 오답 기록이 없습니다.');return;}
      if(confirm('저장된 오답 문제와 복습 상태를 초기화할까요? 누적 정답률은 유지됩니다.')){
        state.wrongBank={};saveState();renderMonitor();
      }
    });
  }

  function startGame(key, reviewQueue=null){
    const mode=modeRegistry.get(key);if(!mode)return;
    monitoring=false;
    clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    currentMode=mode;
    session={mode:reviewQueue?'review':key,limit:reviewQueue?reviewQueue.length:state.settings.questionCount,index:0,correct:0,combo:0,bestCombo:0,elapsed:0,locked:false,startTime:Date.now(),mistakes:0,lastQuestionSignature:null,review:!!reviewQueue,reviewQueue};
    nextQuestion();
  }
  function nextQuestion(){
    if(!session)return;
    tableCleanup();tableCleanup=()=>{};selectedCell=null;
    if(session.index>=session.limit){finishGame();return;}
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
      question=currentMode.makeQuestion({session,state,random,pick,shuffle});
    }
    session.questionStarted=performance.now();session.locked=false;
    renderQuestion();
  }
  function gameHeader(){
    const n=session.index+1,limit=session.limit;
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
  }
  function submitAnswer(value,origin){
    if(!session||session.locked)return;
    const elapsed=performance.now()-session.questionStarted;
    const result=currentMode.checkAnswer(question,value,{settings:state.settings,session});
    if(result===null)return;
    session.locked=true;
    session.elapsed+=elapsed;
    session.index++;
    state.totalAnswered++;
    const correct=typeof result==='object'?Boolean(result.correct):Boolean(result);
    const explanation=typeof result==='object'?result.explanation:question.answerText;
    recordAnswer(currentMode.key,question,correct,elapsed);
    if(correct){
      state.totalRight++;session.correct++;session.combo++;
      session.bestCombo=Math.max(session.bestCombo,session.combo);
      state.bestCombo=Math.max(state.bestCombo,session.combo);
      origin?.classList?.add('correct');
      feedback(true,explanation);successEffect(session.combo,origin);
      playSuccess(session.combo);
      if(state.settings.haptics&&navigator.vibrate)navigator.vibrate(session.combo>=5?[25,30,35]:18);
    }else{
      session.combo=0;session.mistakes++;
      origin?.classList?.add('wrong');
      feedback(false,explanation);
      playWrong();if(state.settings.haptics&&navigator.vibrate)navigator.vibrate([60,40,60]);
    }
    saveState();
    $$('#question-content button, #question-content input, #question-content select').forEach(el=>{el.disabled=true;});
    pendingTimer=setTimeout(()=>{if(session)nextQuestion();},correct?900:1750);
  }
  function feedback(correct,explanation){
    const el=$('#answer-feedback')||$('#table-feedback');if(!el)return;
    el.textContent=correct?'정답! '+(explanation||''):'오답 · '+(explanation||'');
    el.classList.remove('ok','no');el.classList.add(correct?'ok':'no');
  }
  function finishGame(){
    tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);
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

  function toast(message){
    const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1450);
  }
  function obtainAudio(){
    if(!state.settings.sound)return null;
    try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();return audioContext;}catch{return null;}
  }
  function tone(ctx,freq,start,duration,kind='sine',volume=.06){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=kind;o.frequency.setValueAtTime(freq,start);
    g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),start+.012);
    g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g).connect(ctx.destination);o.start(start);o.stop(start+duration+.035);
  }
  function playSuccess(combo){
    const ctx=obtainAudio();if(!ctx)return;const t=ctx.currentTime+.008;
    const scale=[523.25,659.25,783.99,1046.5,1318.5,1568];
    const n=Math.min(6,2+Math.floor(combo/2));
    for(let i=0;i<n;i++){tone(ctx,scale[i],t+i*.075,.16+Math.min(combo,8)*.012,'sine',.058);tone(ctx,scale[i]*2,t+i*.075+.015,.065,'triangle',.013);}
    if(combo>=3){tone(ctx,196,t,.20,'triangle',.040);tone(ctx,1046.5,t+.28,.45,'sine',.030);}
    if(combo>=5){[1760,2093,2637,3136].forEach((f,i)=>tone(ctx,f,t+.18+i*.07,.18,'sine',.014));}
  }
  function playWrong(){const ctx=obtainAudio();if(!ctx)return;const t=ctx.currentTime;tone(ctx,210,t,.16,'triangle',.035);tone(ctx,155,t+.1,.2,'triangle',.030);}
  function stopParticles(){
    particles=[];animating=false;
    fxCtx.clearRect(0,0,canvasW,canvasH);
    $('#celebration')?.classList.remove('show');
  }
  function resizeCanvas(){
    fxRatio=Math.min(devicePixelRatio||1,2);canvasW=innerWidth;canvasH=innerHeight;
    fxCanvas.width=Math.round(canvasW*fxRatio);fxCanvas.height=Math.round(canvasH*fxRatio);
    fxCtx.setTransform(fxRatio,0,0,fxRatio,0,0);
  }
  function successEffect(combo,origin){
    if(reducedMotion)return;
    resizeCanvas();
    const rect=origin?.getBoundingClientRect?.();
    const x=rect?rect.left+rect.width/2:canvasW/2;
    const y=rect?rect.top+rect.height/2:canvasH*.42;
    const colors=['#ff4d9c','#ffd653','#47d8fb','#7b65ff','#52eaae','#ff8965','#fff26d'];
    const count=Math.min(165,24+combo*8);
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,speed=(1.6+Math.random()*5.8)*(combo>=5?1.3:1);
      particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-2.5,rot:Math.random()*6.28,vr:(Math.random()-.5)*.24,life:42+Math.random()*55,maxLife:94,w:3+Math.random()*6,h:3+Math.random()*9,color:pick(colors),kind:Math.random()<.3?'star':'confetti',gravity:.12+Math.random()*.10});
    }
    if(combo>=2){
      const el=$('#celebration');el.textContent=combo>=10?`✦ ${combo} MEGA COMBO ✦`:`${combo} COMBO!`;
      el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
    }
    if(!animating){animating=true;requestAnimationFrame(animateFx);}
  }
  function animateFx(){
    fxCtx.clearRect(0,0,canvasW,canvasH);
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{
      p.life-=1;p.x+=p.vx;p.y+=p.vy;p.vy+=p.gravity;p.vx*=.994;p.rot+=p.vr;
      fxCtx.globalAlpha=Math.min(1,p.life/23);fxCtx.fillStyle=p.color;fxCtx.save();fxCtx.translate(p.x,p.y);fxCtx.rotate(p.rot);
      if(p.kind==='star'){
        fxCtx.beginPath();for(let j=0;j<10;j++){const r=j%2?p.w*.47:p.w*1.65;const theta=(j*Math.PI/5)-Math.PI/2;const xx=Math.cos(theta)*r, yy=Math.sin(theta)*r;j?fxCtx.lineTo(xx,yy):fxCtx.moveTo(xx,yy);}fxCtx.closePath();fxCtx.fill();
      }else{fxCtx.fillRect(-p.w/2,-p.h/2,p.w,p.h);}
      fxCtx.restore();
    });fxCtx.globalAlpha=1;
    if(particles.length)requestAnimationFrame(animateFx);else{animating=false;fxCtx.clearRect(0,0,canvasW,canvasH);}
  }
  addEventListener('resize',()=>{if(particles.length)resizeCanvas();});

  // 1. Alphabet positions A=1 ... Z=26. Keeps weak letters in rotation within a set.
  registerMode({
    key:'alphabet',title:'알파벳 번호',subtitle:'A=1부터 Z=26까지 즉시 변환. 숫자를 직접 입력하세요.',tag:'LETTER → NUMBER',art:'A↔26',
    makeQuestion({session}){
      let n=random(1,26);if(session.lastQuestionSignature===n)n=n%26+1;session.lastQuestionSignature=n;
      return {n,answer:n,answerText:`${letter(n)} = ${n}`};
    },
    render(q){return `<section class="question-card"><div class="question-label">POSITION OF LETTER</div><div class="big-question">${letter(q.n)}</div><div class="question-instruction">이 알파벳은 몇 번째일까요?</div>
      <form class="answer-form" id="answer-form"><input class="answer-input" id="answer-input" type="number" min="1" max="26" inputmode="numeric" autocomplete="off" placeholder="1~26" aria-label="알파벳 순서 번호"><button class="primary-btn" type="submit">확인 ↗</button></form><div class="feedback" id="answer-feedback"></div></section><div class="shortcut-note">A=1 · M=13 · Z=26 | Enter로도 정답 제출</div>`;},
    mount(q,{root,submit}){$('#answer-form',root).addEventListener('submit',e=>{e.preventDefault();const raw=$('#answer-input',root).value;if(raw==='')return;submit(Number(raw),$('button[type=submit]',root));});},
    checkAnswer(q,value){return Number(value)===q.n;}
  });

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

  // 7. Visual search: fill only the numerator/denominator from each numbered statement.
  // The exam-style layout is inspired by common data interpretation formats; all data are synthetic.
  const FINANCE_NAMES=['가온전자','미르소재','하람바이오','새빛반도체'];
  const INDUSTRIES=['고위기술','중고위기술','중저위기술','저위기술'];
  const YEARS=[2022,2023,2024];
  const FINANCE_COLS=[{key:'revenue',label:'매출액'},{key:'operating',label:'영업이익'},{key:'net',label:'당기순이익'},{key:'assets',label:'총자산'}];
  const INDEX_COLS=[{key:'inventory',label:'재고지수'},{key:'shipment',label:'출하지수'}];
  const MONTH_COLS=[{key:'complaints',label:'민원건수'}];
  const KINDER_COLS=[{key:'kindergartens',label:'유치원 수'},{key:'children',label:'원아 수'},{key:'teachers',label:'교원 수'}];
  const keyFor=(row,metric)=>`${row.company}|${row.year}|${metric}`;
  function generateFinance(){
    const rows=[],companyBaseline={};
    FINANCE_NAMES.forEach(c=>companyBaseline[c]={revenue:random(850,3000),om:random(105,235)/1000,nm:random(45,105)/1000,asset:random(2600,6000)});
    for(const company of FINANCE_NAMES){
      const b=companyBaseline[company];
      for(const year of YEARS){
        const trend=1+(year-2022)*random(-3,18)/100;
        const revenue=Math.round(b.revenue*trend*random(91,110)/100);
        const operating=Math.max(1,Math.round(revenue*(b.om+(year-2022)*random(-20,20)/1000)));
        const net=Math.max(1,Math.round(revenue*(b.nm+(year-2022)*random(-18,18)/1000)));
        const assets=Math.round(b.asset*(.88+(year-2022)*.052+random(1,22)/100));
        rows.push({company,year,revenue,operating,net,assets});
      }
    }
    return rows;
  }
  function generateIndustry(){
    const rows=[];
    for(const company of INDUSTRIES){
      const inventoryBase=random(88,115),shipmentBase=random(91,118);
      for(const year of [2021,2022,2023,2024]){
        const inventory=Number((inventoryBase+random(-85,85)/10+(year-2021)*random(-12,18)/10).toFixed(1));
        const shipment=Number((shipmentBase+random(-75,75)/10+(year-2021)*random(-15,15)/10).toFixed(1));
        rows.push({company,year,inventory,shipment});
      }
    }
    return rows;
  }
  function generateMonthly(){
    const rows=[],baselines=Array.from({length:12},()=>random(8500,15000));
    for(let month=1;month<=12;month++){
      for(const year of [2023,2024])rows.push({company:`${month}월`,year,complaints:Math.round(baselines[month-1]*(year===2023?1:random(85,125)/100))});
    }
    return rows;
  }
  function generateKindergarten(){
    const rows=[];
    const base={kindergartens:random(310,470),children:random(27000,47000),teachers:random(2300,3600)};
    for(let year=2018;year<=2024;year++){
      rows.push({company:'갑시',year,kindergartens:Math.round(base.kindergartens*(1-(year-2018)*.015)+random(-6,6)),children:Math.round(base.children*(1-(year-2018)*.035)+random(-360,360)),teachers:Math.round(base.teachers*(1+(year-2018)*.012)+random(-50,50))});
    }
    return rows;
  }
  const TABLE_MODES={
    finance:{title:'기업별 연도별 재무실적 현황',unit:'억 원',cols:FINANCE_COLS},
    industry:{title:'2021~2024년 산업군별 재고지수 및 출하지수',unit:'2020년=100',cols:INDEX_COLS},
    monthly:{title:'2023년과 2024년의 월별 민원건수',unit:'건',cols:MONTH_COLS},
    kindergarten:{title:'2018~2024년 갑시의 유치원 현황',unit:'개, 명',cols:KINDER_COLS}
  };
  function makeTableQuestion({state}){
    const kinds=Object.keys(TABLE_MODES);
    const chosen=kinds.includes(state.settings.tablePreset)?state.settings.tablePreset:pick(kinds);
    const preset=TABLE_MODES[chosen];
    const rows=chosen==='finance'?generateFinance():chosen==='industry'?generateIndustry():chosen==='monthly'?generateMonthly():generateKindergarten();
    const numStatements=Math.max(1,Math.min(4,Number(state.settings.tableOptions)||2));
    const options=[],slots=[],signatures=new Set();
    const numerals=['①','②','③','④'];
    const template=()=>{
      const r=pick(rows);
      let numerator,denominator,text;
      if(chosen==='finance'){
        const ratio=pick([
          ['net','revenue',`매출액 대비 당기순이익 비율`],
          ['operating','revenue',`매출액 대비 영업이익 비율`],
          ['net','assets',`총자산 대비 당기순이익 비율`],
          ['operating','assets',`총자산 대비 영업이익 비율`]
        ]);
        [numerator,denominator]=ratio;
        text=`${r.year}년 ${r.company}의 ${ratio[2]}`;
      }else if(chosen==='industry'){
        numerator='inventory';denominator='shipment';
        text=`${r.year}년 ${r.company}산업군의 재고율`;
      }else if(chosen==='monthly'){
        const otherYear=r.year===2024?2023:2024;
        const base=rows.find(x=>x.year===otherYear&&x.company===r.company);
        numerator='complaints';denominator='complaints';
        text=`${r.company} 민원건수의 ${r.year}년 수치가 ${otherYear}년 수치에서 차지하는 비율`;
        return {text,numRow:r,denRow:base,numerator,denominator};
      }else{
        const ratio=pick([
          ['children','teachers','교원 1인당 원아 수'],
          ['children','kindergartens','유치원 1곳당 원아 수'],
          ['teachers','kindergartens','유치원 1곳당 교원 수']
        ]);
        [numerator,denominator]=ratio;
        text=`${r.year}년 갑시의 ${ratio[2]}`;
      }
      return {text,numRow:r,denRow:r,numerator,denominator};
    };
    for(let i=0;i<numStatements;i++){
      let candidate,signature='',attempts=0;
      do{
        candidate=template();
        signature=`${candidate.text}|${keyFor(candidate.numRow,candidate.numerator)}|${keyFor(candidate.denRow,candidate.denominator)}`;
      }while(signatures.has(signature)&&++attempts<160);
      signatures.add(signature);
      const numSlot={id:`s${i}-num`,expectedKey:keyFor(candidate.numRow,candidate.numerator),expectedValue:candidate.numRow[candidate.numerator],filled:false};
      const denSlot={id:`s${i}-den`,expectedKey:keyFor(candidate.denRow,candidate.denominator),expectedValue:candidate.denRow[candidate.denominator],filled:false};
      slots.push(numSlot,denSlot);
      options.push({number:numerals[i],text:candidate.text,slots:[numSlot,denSlot]});
    }
    return {kind:chosen,preset,rows,options,slots,errors:0,answerText:`${numStatements}개 선지의 자료 탐색 완료`,numStatements};
  }
  function numericCell(q,r,key){
    const label=q.preset.cols.find(c=>c.key===key)?.label;
    return `<td class="numeric" data-key="${escapeHtml(keyFor(r,key))}" data-value="${r[key]}" tabindex="0" role="button" aria-label="${escapeHtml(`${r.year}년 ${r.company} ${label} ${r[key]}`)}">${two(r[key])}</td>`;
  }
  function renderDataTable(q){
    if(q.kind==='finance'){
      return `<table class="gsat-table finance-table" id="gsat-table"><thead><tr><th scope="col">기업</th><th scope="col">연도</th>${FINANCE_COLS.map(c=>`<th scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${q.rows.map((r,i)=>`<tr class="${r.year===2022&&i?'group-start':''}"><th scope="row" class="label-cell">${r.company}</th><td>${r.year}</td>${FINANCE_COLS.map(c=>numericCell(q,r,c.key)).join('')}</tr>`).join('')}</tbody></table>`;
    }
    if(q.kind==='industry'){
      const lines=[];
      for(const year of [2021,2022,2023,2024]){
        INDEX_COLS.forEach((col,i)=>lines.push(`<tr class="${i===0&&year!==2021?'group-start':''}">${i===0?`<th scope="rowgroup" rowspan="2" class="label-cell">${year}</th>`:''}<th scope="row" class="label-cell">${col.label}</th>${INDUSTRIES.map(company=>numericCell(q,q.rows.find(r=>r.company===company&&r.year===year),col.key)).join('')}</tr>`));
      }
      return `<table class="gsat-table industry-table" id="gsat-table"><thead><tr><th scope="col">연도</th><th scope="col">지수</th>${INDUSTRIES.map(c=>`<th scope="col">${c}<small>산업군</small></th>`).join('')}</tr></thead><tbody>${lines.join('')}</tbody></table>`;
    }
    if(q.kind==='kindergarten'){
      return `<table class="gsat-table kindergarten-table" id="gsat-table"><thead><tr><th scope="col">연도</th>${KINDER_COLS.map(c=>`<th scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${q.rows.map(r=>`<tr><th scope="row" class="label-cell">${r.year}</th>${KINDER_COLS.map(c=>numericCell(q,r,c.key)).join('')}</tr>`).join('')}</tbody></table>`;
    }
    const trs=[];
    for(let month=1;month<=12;month++){
      const a=q.rows.find(r=>r.company===`${month}월`&&r.year===2023);
      const b=q.rows.find(r=>r.company===`${month}월`&&r.year===2024);
      trs.push(`<tr><th class="label-cell" scope="row">${month}월</th>${numericCell(q,a,'complaints')}${numericCell(q,b,'complaints')}</tr>`);
    }
    const sum=y=>q.rows.filter(r=>r.year===y).reduce((n,r)=>n+r.complaints,0);
    return `<table class="gsat-table monthly-table" id="gsat-table"><thead><tr><th scope="col">월</th><th scope="col">2023년</th><th scope="col">2024년</th></tr></thead><tbody>${trs.join('')}<tr class="group-start total-row"><th scope="row">합계</th><td>${two(sum(2023))}</td><td>${two(sum(2024))}</td></tr></tbody></table>`;
  }
  function renderTableQuestion(q){
    return `<section class="exam-paper" aria-label="자료해석 시험지">
      <div class="exam-paper-meta"><span>자료해석 · 시선 탐색</span><span>${q.numStatements}개 선지</span></div>
      <div class="exam-question">다음 <span class="exam-bracket">&lt;표&gt;</span>를 보고 각 선지에 필요한 수치를 찾으시오.</div>
      <div class="exam-options">${q.options.map(opt=>`<div class="exam-option"><div class="exam-option-text"><span class="exam-option-number">${opt.number}</span><span>${escapeHtml(opt.text)}</span></div><div class="exam-option-ratio"><div class="drop-slot" data-drop="${opt.slots[0].id}" tabindex="0" role="button" aria-label="${escapeHtml(opt.number)} 분자" aria-description="표에서 분자에 해당하는 수치를 선택하세요"><span class="slot-val" aria-hidden="true"></span></div><span class="fraction-slash" aria-hidden="true">/</span><div class="drop-slot" data-drop="${opt.slots[1].id}" tabindex="0" role="button" aria-label="${escapeHtml(opt.number)} 분모" aria-description="표에서 분모에 해당하는 수치를 선택하세요"><span class="slot-val" aria-hidden="true"></span></div></div></div>`).join('')}</div>
      <div class="exam-table-wrap"><div class="exam-table-title">&lt;표&gt; ${escapeHtml(q.preset.title)}</div><div class="exam-table-unit">(단위: ${escapeHtml(q.preset.unit)})</div>
      <div class="table-viewport" id="table-viewport" aria-label="${escapeHtml(q.preset.title)}" tabindex="0">${renderDataTable(q)}</div>
      <div class="table-bottom"><span class="table-legend">※ 가상 자료 · 셀을 탭하거나 길게 누른 후 드래그</span><button class="table-zoom-btn" id="table-zoom" type="button" aria-pressed="false">표 크게 보기 +</button></div></div>
      </section><div class="table-feedback" id="table-feedback" aria-live="polite"></div>`;
  }
  function mountTableQuestion(q,{root,submit}){
    const viewport=$('#table-viewport',root),table=$('#gsat-table',root);
    let interaction=null,selected=null,dragGhost=null,active=true;
    function notifyWrong(slotEl){
      if(!slotEl)return;
      q.errors++;
      slotEl.classList.add('drop-error');setTimeout(()=>slotEl?.classList.remove('drop-error'),410);
      if(state.settings.haptics&&navigator.vibrate)navigator.vibrate(38);
      playWrong();
      const message=$('#table-feedback',root);
      if(message){message.textContent='항목 · 연도 · 분류를 다시 확인하세요.';message.classList.add('no');}
      if(session){session.combo=0;session.mistakes++;const chip=$('.combo-chip');chip?.classList.remove('active');const num=$('.combo-chip strong');if(num)num.textContent='0';}
    }
    function fill(slotEl,cell){
      if(!active||!slotEl||!cell||session?.locked)return;
      const slot=q.slots.find(s=>s.id===slotEl.dataset.drop);if(!slot)return;
      if(slot.expectedKey!==cell.dataset.key){notifyWrong(slotEl);return;}
      slot.filled=true;slotEl.classList.add('filled');
      $('.slot-val',slotEl).textContent=two(Number(cell.dataset.value));
      const feedbackEl=$('#table-feedback',root);
      feedbackEl.classList.remove('no');feedbackEl.textContent='';
      if(selected){selected.classList.remove('cell-picked');selected=null;}
      if(q.slots.every(s=>s.filled)){
        const el=$('.exam-option-ratio',root);
        if(feedbackEl)feedbackEl.textContent=q.errors?'탐색 완료 · 잘못 고른 셀이 있었습니다.':'모든 선지를 정확하게 찾았습니다.';
        submit({complete:true,errors:q.errors},el);
      }
    }
    function selectCell(cell){
      if(selected)selected.classList.remove('cell-picked');
      selected=cell;cell.classList.add('cell-picked');
    }
    function clearDrag(){
      if(dragGhost){dragGhost.remove();dragGhost=null;}
      $$('.drop-active',root).forEach(el=>el.classList.remove('drop-active'));
    }
    function beginDrag(p){
      if(!p||p.scrolling||!active||session?.locked)return;
      p.dragging=true;if(p.timer)clearTimeout(p.timer);
      dragGhost=document.createElement('div');dragGhost.className='drag-ghost';dragGhost.textContent=two(Number(p.cell.dataset.value));document.body.appendChild(dragGhost);
      dragGhost.style.left=p.x+'px';dragGhost.style.top=p.y+'px';
      $$('.drop-slot',root).forEach(s=>s.classList.add('drop-active'));
    }
    function pointerdown(e){
      if(!active||session?.locked)return;
      const cell=e.target.closest('td.numeric');if(!cell)return;
      if(e.pointerType==='mouse')e.preventDefault();
      interaction={pointerId:e.pointerId,cell,startX:e.clientX,startY:e.clientY,startPageY:window.scrollY,x:e.clientX,y:e.clientY,scrollLeft:viewport.scrollLeft,scrolling:false,dragging:false,timer:null,type:e.pointerType};
      if(e.pointerType==='touch'||e.pointerType==='pen')interaction.timer=setTimeout(()=>beginDrag(interaction),290);
    }
    function pointermove(e){
      const p=interaction;if(!p||e.pointerId!==p.pointerId)return;
      p.x=e.clientX;p.y=e.clientY;
      const dx=e.clientX-p.startX,dy=e.clientY-p.startY;
      if(!p.dragging){
        if(p.type==='mouse'){if(Math.hypot(dx,dy)>7)beginDrag(p);}
        else if(Math.hypot(dx,dy)>9){p.scrolling=true;clearTimeout(p.timer);
          if(Math.abs(dx)>Math.abs(dy)*1.12)viewport.scrollLeft=p.scrollLeft-dx;
          else window.scrollTo(window.scrollX,p.startPageY-dy);
        }
      }
      if(p.dragging&&dragGhost){
        dragGhost.style.left=e.clientX+'px';dragGhost.style.top=e.clientY+'px';
        if(e.clientY<60)window.scrollBy(0,-16);
        if(e.clientY>window.innerHeight-60)window.scrollBy(0,16);
      }
    }
    function pointerup(e){
      const p=interaction;if(!p||e.pointerId!==p.pointerId)return;
      clearTimeout(p.timer);
      if(p.dragging){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-drop]');if(target)fill(target,p.cell);}
      else if(!p.scrolling)selectCell(p.cell);
      clearDrag();interaction=null;
    }
    function pointercancel(e){const p=interaction;if(!p||e.pointerId!==p.pointerId)return;clearTimeout(p.timer);clearDrag();interaction=null;}
    table.addEventListener('pointerdown',pointerdown);
    document.addEventListener('pointermove',pointermove);
    document.addEventListener('pointerup',pointerup);
    document.addEventListener('pointercancel',pointercancel);
    const keydown=e=>{const cell=e.target.closest('td.numeric');if(cell&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectCell(cell);}};
    table.addEventListener('keydown',keydown);
    const onSlotClick=e=>{if(selected)fill(e.currentTarget,selected);};
    const onSlotKeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSlotClick({currentTarget:e.currentTarget});}};
    $$('.drop-slot',root).forEach(el=>{el.addEventListener('click',onSlotClick);el.addEventListener('keydown',onSlotKeydown);});
    const zoomBtn=$('#table-zoom',root);
    zoomBtn.addEventListener('click',()=>{
      const enlarged=viewport.classList.toggle('table-enlarged');
      zoomBtn.textContent=enlarged?'표 전체 보기 −':'표 크게 보기 +';
      zoomBtn.setAttribute('aria-pressed',String(enlarged));
      viewport.scrollLeft=0;
    });
    tableCleanup=()=>{
      active=false;document.removeEventListener('pointermove',pointermove);document.removeEventListener('pointerup',pointerup);document.removeEventListener('pointercancel',pointercancel);
      if(interaction?.timer)clearTimeout(interaction.timer);clearDrag();
    };
  }
  registerMode({key:'table',title:'표 탐색 · 선지',subtitle:'선지를 읽고 표에서 분자와 분모를 찾아 채우세요.',tag:'VISUAL SCAN / DATA',art:'▦',
    makeQuestion:makeTableQuestion,render:renderTableQuestion,mount:mountTableQuestion,
    checkAnswer(q,value){return {correct:Boolean(value?.complete)&&q.errors===0,explanation:q.errors?`잘못 선택한 셀 ${q.errors}회 · 정확도를 높여보세요.`:q.answerText};}
  });

  // Basic categorical Venn practice is a distinct submode within the logic card.
  // A gray/shaded region means EMPTY; × means at least one EXISTING member.
  // Crucially, overlap of the printed circles is not an existential assertion.
  const DIAGRAM_TYPES=[
    {key:'allAB',text:'모든 A는 B이다.',relation:'A ⊆ B',region:'aOnly',mark:'shade',explain:'A 중 B 밖에 있는 부분이 비어 있습니다. A가 실제로 존재한다는 뜻은 아닙니다.'},
    {key:'allBA',text:'모든 B는 A이다.',relation:'B ⊆ A',region:'bOnly',mark:'shade',explain:'B 중 A 밖에 있는 부분이 비어 있습니다. B가 실제로 존재한다는 뜻은 아닙니다.'},
    {key:'noneAB',text:'어떤 A도 B가 아니다.',relation:'A ∩ B = ∅',region:'overlap',mark:'shade',explain:'A와 B의 공통 부분에는 어떤 대상도 존재하지 않습니다.'},
    {key:'someAB',text:'어떤 A는 B이다.',relation:'A ∩ B ≠ ∅',region:'overlap',mark:'x',explain:'A와 B에 동시에 속하는 대상이 적어도 하나 존재합니다.'},
    {key:'someAnotB',text:'어떤 A는 B가 아니다.',relation:'A ∖ B ≠ ∅',region:'aOnly',mark:'x',explain:'A에는 속하지만 B에는 속하지 않는 대상이 적어도 하나 있습니다.'},
    {key:'someBnotA',text:'어떤 B는 A가 아니다.',relation:'B ∖ A ≠ ∅',region:'bOnly',mark:'x',explain:'B에는 속하지만 A에는 속하지 않는 대상이 적어도 하나 있습니다.'}
  ];
  let diagramSvgCounter=0;
  function diagramSvg(type,{compact=false}={}){
    const id='venn-'+(++diagramSvgCounter);
    // Two overlapping circles are deliberately kept fixed across all answers.
    // It is the shading / witness X that carries the logical meaning.
    let shade='';
    if(type.mark==='shade'){
      if(type.region==='aOnly')shade=`<circle cx="103" cy="76" r="57" fill="#abb5c5" opacity=".76" clip-path="url(#${id}-a)" mask="url(#${id}-not-b)"/>`;
      else if(type.region==='bOnly')shade=`<circle cx="157" cy="76" r="57" fill="#abb5c5" opacity=".76" clip-path="url(#${id}-b)" mask="url(#${id}-not-a)"/>`;
      else shade=`<circle cx="157" cy="76" r="57" fill="#abb5c5" opacity=".76" clip-path="url(#${id}-a)"/>`;
    }
    const witness={aOnly:[77,98],overlap:[130,98],bOnly:[183,98]}[type.region];
    const cross=type.mark==='x'?`<g transform="translate(${witness[0]} ${witness[1]})"><circle cx="0" cy="0" r="12" fill="#fff" opacity=".93"/><path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#121926" stroke-linecap="round" stroke-width="3.7"/></g>`:'';
    return `<svg class="diagram-svg${compact?' compact':''}" viewBox="0 0 260 156" role="img" aria-label="${escapeHtml(type.text)}의 집합 다이어그램" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="${id}-a"><circle cx="103" cy="76" r="57"/></clipPath>
        <clipPath id="${id}-b"><circle cx="157" cy="76" r="57"/></clipPath>
        <mask id="${id}-not-a" maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="156"><rect width="260" height="156" fill="#fff"/><circle cx="103" cy="76" r="57" fill="#000"/></mask>
        <mask id="${id}-not-b" maskUnits="userSpaceOnUse" x="0" y="0" width="260" height="156"><rect width="260" height="156" fill="#fff"/><circle cx="157" cy="76" r="57" fill="#000"/></mask>
      </defs>
      ${shade}
      <circle cx="103" cy="76" r="57" fill="none" stroke="#303c50" stroke-width="2"/>
      <circle cx="157" cy="76" r="57" fill="none" stroke="#303c50" stroke-width="2"/>
      <text x="82" y="54" fill="#202a3b" font-size="19" font-weight="750" text-anchor="middle">A</text>
      <text x="178" y="54" fill="#202a3b" font-size="19" font-weight="750" text-anchor="middle">B</text>
      ${cross}
    </svg>`;
  }
  function renderDiagramStudy(){
    tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);
    session=null;currentMode=null;question=null;studyMode='reason';
    app.innerHTML=`${topbar()}
      <div class="game-head"><button class="back-btn" id="study-back">← 훈련 선택</button><span class="game-caption">STUDY / NO TIMER</span></div>
      <div class="study-header"><div class="eyebrow">LOGIC / BASIC</div><h1>집합 다이어그램 암기</h1><p>명제의 표현에 따라 집합의 어느 영역이 비거나, 어느 영역에 대상이 존재하는지 익힙니다.</p></div>
      <div class="diagram-legend" aria-label="다이어그램 읽는 법"><span><span class="legend-square"></span> 회색 음영 = 반드시 비어 있는 영역</span><span><strong class="legend-x">×</strong> = 대상이 1개 이상 존재</span></div>
      <div class="diagram-study-callout">두 원이 겹쳐 그려진 것만으로 교집합에 원소가 있다는 뜻은 아닙니다. <strong>음영과 × 표시를 기준으로 판별하세요.</strong></div>
      <div class="study-toolbar"><button class="study-toggle selected" id="reveal-all">전체 보기</button><button class="study-toggle" id="hide-all">가리고 외우기</button><button class="primary-btn study-play" id="study-play">다이어그램 퀴즈 →</button></div>
      <div class="diagram-study-grid">${DIAGRAM_TYPES.map((t,i)=>`<button type="button" class="diagram-study-card" data-diagram-study="${i}" aria-pressed="true">
        <span class="diagram-study-statement">${escapeHtml(t.text)}</span>
        <span class="diagram-study-illustration">${diagramSvg(t)}<span class="diagram-masked-label">눌러서 확인</span></span>
        <span class="diagram-study-detail"><strong>${escapeHtml(t.relation)}</strong><small>${escapeHtml(t.explain)}</small></span>
      </button>`).join('')}</div>
      <div class="study-footnote">가리고 외우기를 누른 다음 각 문장을 보고 다이어그램을 떠올려보세요. 이 화면의 학습 시간과 정답률은 기록하지 않습니다.</div>`;
    bindTopbar();
    $('#study-back').addEventListener('click',exitGame);
    $('#study-play').addEventListener('click',()=>startGame('diagram'));
    const items=$$('[data-diagram-study]');
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
  function makeDiagramQuestion({session,shuffle,pick}){
    let correct=pick(DIAGRAM_TYPES);
    if(correct.key===session.lastQuestionSignature)correct=pick(DIAGRAM_TYPES.filter(t=>t.key!==correct.key));
    session.lastQuestionSignature=correct.key;
    const distractors=shuffle(DIAGRAM_TYPES.filter(t=>t.key!==correct.key)).slice(0,3);
    const alternatives=shuffle([correct,...distractors]);
    return {statement:correct.text,correctKey:correct.key,correctIndex:alternatives.findIndex(t=>t.key===correct.key),
      alternatives, explanation:`${correct.relation} · ${correct.explain}`};
  }
  function renderDiagramQuestion(q){
    return `<section class="reason-paper diagram-quiz-paper" aria-label="집합 다이어그램 문제">
      <div class="reason-meta"><span>집합 · 명제 / 기본</span><span>다이어그램 선택</span></div>
      <p class="diagram-question-instruction">다음 명제를 나타내는 다이어그램을 고르세요.</p>
      <div class="diagram-statement">${escapeHtml(q.statement)}</div>
      <div class="diagram-legend quiz-legend"><span><span class="legend-square"></span> 회색 = 비어 있음</span><span><strong class="legend-x">×</strong> = 1개 이상 존재</span></div>
      <div class="diagram-option-grid">${q.alternatives.map((t,i)=>`<button type="button" class="diagram-option" data-diagram-choice="${i}" aria-label="${i+1}번 다이어그램"><span class="diagram-option-number">${REASON_NUMBER[i]}</span>${diagramSvg(t,{compact:true})}</button>`).join('')}</div>
      <div class="feedback reason-feedback" id="answer-feedback" aria-live="polite"></div>
      <p class="reason-hint">모든 A는 B라는 표현은 A의 존재를 보장하지 않습니다. 음영과 ×를 구별하세요.</p>
    </section>`;
  }
  function mountDiagramQuestion(q,{root,submit}){
    $$('.diagram-option',root).forEach(b=>b.addEventListener('click',()=>{
      const index=Number(b.dataset.diagramChoice);
      if(index!==q.correctIndex)$(`[data-diagram-choice="${q.correctIndex}"]`,root)?.classList.add('diagram-answer-reveal');
      submit(index,b);
    }));
  }
  registerMode({key:'diagram',hidden:true,title:'집합 다이어그램',subtitle:'명제에 맞는 음영과 × 표시를 고르는 기초 훈련',tag:'LOGIC / DIAGRAM',art:'◯',
    makeQuestion:makeDiagramQuestion,render:renderDiagramQuestion,mount:mountDiagramQuestion,
    checkAnswer(q,value){return {correct:Number(value)===q.correctIndex,explanation:q.explanation};}
  });

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

  // PWA works when the files are served through HTTPS or localhost; file:// still plays normally.
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
    addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
  renderHome();
})();