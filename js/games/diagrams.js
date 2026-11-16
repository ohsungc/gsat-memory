'use strict';
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
    stopFeverTimer();tableCleanup();tableCleanup=()=>{};clearTimeout(pendingTimer);
    session=null;currentMode=null;question=null;studyMode='reason';
    app.innerHTML=`${topbar()}
      <div class="game-head"><button class="back-btn" id="study-back">← 훈련 선택</button><span class="game-caption">STUDY / NO TIMER</span></div>
      <div class="study-header"><div class="eyebrow">LOGIC / BASIC</div><h1>집합 다이어그램 암기</h1><p>명제의 표현에 따라 집합의 어느 영역이 비거나, 어느 영역에 대상이 존재하는지 익힙니다.</p></div>
      <div class="diagram-legend" aria-label="다이어그램 읽는 법"><span><span class="legend-square"></span> 회색 음영 = 반드시 비어 있는 영역</span><span><strong class="legend-x">×</strong> = 대상이 1개 이상 존재</span></div>
      <div class="diagram-study-callout">두 원이 겹쳐 그려진 것만으로 교집합에 원소가 있다는 뜻은 아닙니다. <strong>음영과 × 표시를 기준으로 판별하세요.</strong></div>
      <div class="study-toolbar"><button class="study-toggle selected" id="reveal-all">전체 보기</button><button class="study-toggle" id="hide-all">가리고 외우기</button><button class="primary-btn study-play" id="study-play">다이어그램 퀴즈 →</button><button class="mode-fever secondary-btn" id="study-fever">FEVER ⚡</button></div>
      <div class="diagram-study-grid">${DIAGRAM_TYPES.map((t,i)=>`<button type="button" class="diagram-study-card" data-diagram-study="${i}" aria-pressed="true">
        <span class="diagram-study-statement">${escapeHtml(t.text)}</span>
        <span class="diagram-study-illustration">${diagramSvg(t)}<span class="diagram-masked-label">눌러서 확인</span></span>
        <span class="diagram-study-detail"><strong>${escapeHtml(t.relation)}</strong><small>${escapeHtml(t.explain)}</small></span>
      </button>`).join('')}</div>
      <div class="study-footnote">가리고 외우기를 누른 다음 각 문장을 보고 다이어그램을 떠올려보세요. 이 화면의 학습 시간과 정답률은 기록하지 않습니다.</div>`;
    bindTopbar();
    $('#study-back').addEventListener('click',exitGame);
    $('#study-play').addEventListener('click',()=>startGame('diagram'));
    $('#study-fever').addEventListener('click',()=>renderFeverIntro('diagram'));
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
