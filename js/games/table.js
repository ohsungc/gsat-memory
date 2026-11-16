'use strict';
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
