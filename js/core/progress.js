'use strict';
  // Local-only monitoring; previous v1 storage key is retained for seamless migration.
  // Bank keeps exact question snapshots for deterministic replay, including table/logic modes.
  function questionIdentity(mode,q){
    if(q._wrongKey)return q._wrongKey;
    let signature;
    if(mode==='alphabet')signature=q.direction==='reverse'?`reverse:${q.n}`:`${q.n}`;
    else if(mode==='fraction'||mode==='applied')signature=`${q.num}/${q.den}`;
    else if(mode==='divide')signature=`${q.dividend}/${q.divisor}`;
    else if(mode==='reversePercent')signature=`${q.percent}:${q.part}`;
    else if(mode==='fractionCompare')signature=`${q.a}/${q.b}|${q.c}/${q.d}`;
    else if(mode==='diagram')signature=q.correctKey;
    else if(mode==='scheme')signature=JSON.stringify({s:q.set.map(o=>o.op),r:q.route,v:q.source,p:q.part});
    else if(mode==='deduction')signature=JSON.stringify({k:q.kind,l:q.lead,c:q.clues,o:q.options});
    else if(mode==='reason')signature=JSON.stringify({t:q.task,p:q.premises,c:q.conclusion});
    else if(mode==='table')signature=`${q.kind}:`+JSON.stringify(q.rows)+JSON.stringify(q.options.map(o=>o.text));
    else signature=JSON.stringify(q);
    return `${mode}|${signature}`;
  }
  function questionLabel(mode,q){
    if(mode==='alphabet')return q.direction==='reverse'?`${q.n} → ? (알파벳)`:`${letter(q.n)} = ?`;
    if(mode==='fraction'||mode==='applied')return `${q.num}/${q.den} = ?%`;
    if(mode==='divide')return `${q.dividend} ÷ ${q.divisor} = ?`;
    if(mode==='reversePercent')return `${two(q.part)}은 전체의 ${q.percent}% · 전체는?`;
    if(mode==='fractionCompare')return `${q.a}/${q.b}  ?  ${q.c}/${q.d}`;
    if(mode==='diagram')return q.statement;
    if(mode==='scheme')return `도식 ${q.group} · ${q.part+1}/4 · ${q.source} · ${q.route.join('→')}`;
    if(mode==='deduction')return `${q.kind} · ${q.headline}`;
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
    scratchpadHide();
    stopParticles();
    clearTimeout(pendingTimer);tableCleanup();tableCleanup=()=>{};
    stopFeverTimer();monitoring=true;session=null;currentMode=null;question=null;studyMode=null;
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
