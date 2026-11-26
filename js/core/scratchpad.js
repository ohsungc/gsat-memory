'use strict';
/* Black-and-white, client-only memo board for reasoning questions.
   Keeps one memo per diagram group (4 questions), otherwise per question.
   Vector strokes are kept only in memory; they never enter the question bank. */
const SCRATCHPAD_MODES = new Set(['scheme', 'deduction', 'reason', 'diagram']);
const scratchpad = {
  session: null, key: null, opened: false, tool: 'pen', strokes: [],
  history: [], activeStroke: null, drag: null, position: null
};

function scratchpadNode() {
  let root = document.getElementById('scratchpad-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'scratchpad-root';
    document.body.appendChild(root);
  }
  return root;
}

function scratchpadIdentity() {
  if (!session || !question || !currentMode) return null;
  if (session.review) return `${currentMode.key}:review:${session.index}`;
  if (currentMode.key === 'scheme') return `scheme:group:${question.group ?? Math.floor(session.index / 4)}`;
  return `${currentMode.key}:question:${session.index}`;
}

function scratchpadSync() {
  const root = scratchpadNode();
  if (!currentMode || !session || !SCRATCHPAD_MODES.has(currentMode.key)) {
    scratchpadHide(); return;
  }
  const identity = scratchpadIdentity();
  if (scratchpad.session !== session || scratchpad.key !== identity) {
    scratchpad.session = session;
    scratchpad.key = identity;
    scratchpad.strokes = [];
    scratchpad.history = [];
    scratchpad.activeStroke = null;
  }
  const previouslyOpen = scratchpad.opened;
  root.hidden = false;
  root.innerHTML = `<button type="button" class="scratch-trigger" id="scratch-toggle" aria-label="흑백 메모 그림판 열기" aria-expanded="${previouslyOpen}">✎ <span>메모</span></button>
    <section class="scratch-panel${previouslyOpen?' scratch-visible':''}" id="scratch-panel" aria-label="메모 그림판">
      <div class="scratch-heading" id="scratch-heading"><strong>메모 그림판</strong><span class="scratch-heading-note">${currentMode.key==='scheme'?'도식 4문항 동안 유지':'문제마다 초기화'}</span><button type="button" id="scratch-close" class="scratch-close" aria-label="그림판 접기">×</button></div>
      <div class="scratch-tools" role="toolbar" aria-label="그림 도구">
        <button type="button" data-scratch-tool="pen" class="scratch-tool${scratchpad.tool==='pen'?' selected':''}" aria-pressed="${scratchpad.tool==='pen'}">● 펜</button>
        <button type="button" data-scratch-tool="eraser" class="scratch-tool${scratchpad.tool==='eraser'?' selected':''}" aria-pressed="${scratchpad.tool==='eraser'}">□ 지우개</button>
        <button type="button" id="scratch-undo" class="scratch-tool">↶ 되돌리기</button>
        <button type="button" id="scratch-clear" class="scratch-tool scratch-clear">전체 지우기</button>
      </div>
      <canvas id="scratch-canvas" aria-label="검정색 펜으로 메모하는 흰색 그림판"></canvas>
      <div class="scratch-foot">손가락·터치펜·마우스로 그리기 · 저장되지 않는 임시 메모</div>
    </section>`;
  const toggle = () => scratchpadSetOpen(!scratchpad.opened);
  root.querySelector('#scratch-toggle').addEventListener('click', toggle);
  root.querySelector('#scratch-close').addEventListener('click', () => scratchpadSetOpen(false));
  root.querySelectorAll('[data-scratch-tool]').forEach(btn => btn.addEventListener('click', () => {
    scratchpad.tool = btn.dataset.scratchTool;
    root.querySelectorAll('[data-scratch-tool]').forEach(el => {
      const active = el.dataset.scratchTool === scratchpad.tool;
      el.classList.toggle('selected', active);
      el.setAttribute('aria-pressed', String(active));
    });
  }));
  root.querySelector('#scratch-undo').addEventListener('click', () => {
    const prev = scratchpad.history.pop();
    if (prev) { scratchpad.strokes = prev; scratchpadRedraw(); }
  });
  root.querySelector('#scratch-clear').addEventListener('click', () => {
    if (!scratchpad.strokes.length) return;
    scratchpad.history.push(scratchpad.strokes);
    scratchpad.strokes = [];
    scratchpadRedraw();
  });
  const canvas = root.querySelector('#scratch-canvas');
  canvas.addEventListener('pointerdown', scratchpadDown);
  canvas.addEventListener('pointermove', scratchpadMove);
  canvas.addEventListener('pointerup', scratchpadUp);
  canvas.addEventListener('pointercancel', scratchpadUp);
  canvas.addEventListener('lostpointercapture', scratchpadUp);
  const heading = root.querySelector('#scratch-heading');
  heading.addEventListener('pointerdown', scratchpadDragStart);
  if (scratchpad.position && window.innerWidth > 650) {
    const panel = root.querySelector('#scratch-panel');
    panel.style.left = `${scratchpad.position.x}px`;
    panel.style.top = `${scratchpad.position.y}px`;
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  }
  if (previouslyOpen) requestAnimationFrame(scratchpadRedraw);
}

function scratchpadSetOpen(open) {
  scratchpad.opened = !!open;
  const root = scratchpadNode();
  root.querySelector('#scratch-panel')?.classList.toggle('scratch-visible', scratchpad.opened);
  root.querySelector('#scratch-toggle')?.setAttribute('aria-expanded', String(scratchpad.opened));
  root.querySelector('#scratch-toggle')?.classList.toggle('active', scratchpad.opened);
  if (scratchpad.opened) requestAnimationFrame(scratchpadRedraw);
}

function scratchpadHide() {
  const root = document.getElementById('scratchpad-root');
  if (root) root.hidden = true;
  scratchpad.opened = false;
  scratchpad.drag = null;
  scratchpad.activeStroke = null;
}

function scratchpadPoint(e, canvas) {
  const r = canvas.getBoundingClientRect();
  return {x: Math.min(1, Math.max(0, (e.clientX-r.left)/r.width)),
          y: Math.min(1, Math.max(0, (e.clientY-r.top)/r.height))};
}

function scratchpadDown(e) {
  if (!e.isPrimary || e.button !== 0) return;
  e.preventDefault();
  const canvas = e.currentTarget;
  scratchpad.history.push(scratchpad.strokes.slice());
  if (scratchpad.history.length > 60) scratchpad.history.shift();
  scratchpad.activeStroke = {pointer:e.pointerId, tool:scratchpad.tool, points:[scratchpadPoint(e,canvas)]};
  scratchpad.strokes.push(scratchpad.activeStroke);
  canvas.setPointerCapture(e.pointerId);
  scratchpadRedraw();
}

function scratchpadMove(e) {
  if (!scratchpad.activeStroke || scratchpad.activeStroke.pointer !== e.pointerId) return;
  e.preventDefault();
  const p = scratchpadPoint(e, e.currentTarget);
  const pts = scratchpad.activeStroke.points;
  if (Math.hypot(p.x-pts.at(-1).x,p.y-pts.at(-1).y) > 0.0015) pts.push(p);
  scratchpadRedraw();
}

function scratchpadUp(e) {
  if (!scratchpad.activeStroke || scratchpad.activeStroke.pointer !== e.pointerId) return;
  scratchpad.activeStroke = null;
}

function scratchpadRedraw() {
  const canvas = document.getElementById('scratch-canvas');
  if (!canvas || !scratchpad.opened) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {canvas.width=w; canvas.height=h;}
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,rect.width,rect.height);
  ctx.lineCap='round';ctx.lineJoin='round';
  for (const stroke of scratchpad.strokes) {
    const pts=stroke.points;
    if (!pts || !pts.length) continue;
    ctx.strokeStyle=stroke.tool==='eraser'?'#fff':'#111';
    ctx.fillStyle=ctx.strokeStyle;
    ctx.lineWidth=stroke.tool==='eraser'?18:2.8;
    if (pts.length===1) {
      ctx.beginPath();ctx.arc(pts[0].x*rect.width,pts[0].y*rect.height,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();
    } else {
      ctx.beginPath();ctx.moveTo(pts[0].x*rect.width,pts[0].y*rect.height);
      for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x*rect.width,pts[i].y*rect.height);
      ctx.stroke();
    }
  }
}

function scratchpadDragStart(e) {
  if (window.innerWidth <= 650 || e.target.closest('button') || !e.isPrimary) return;
  const panel = document.getElementById('scratch-panel');
  if (!panel) return;
  const r = panel.getBoundingClientRect();
  scratchpad.drag = {pointer:e.pointerId, offsetX:e.clientX-r.left, offsetY:e.clientY-r.top};
  e.currentTarget.setPointerCapture(e.pointerId);
}
function scratchpadDragMove(e) {
  if (!scratchpad.drag || scratchpad.drag.pointer!==e.pointerId) return;
  const panel=document.getElementById('scratch-panel');if (!panel) return;
  const r=panel.getBoundingClientRect();
  const x=Math.max(6,Math.min(innerWidth-r.width-6,e.clientX-scratchpad.drag.offsetX));
  const y=Math.max(6,Math.min(innerHeight-r.height-6,e.clientY-scratchpad.drag.offsetY));
  scratchpad.position={x,y};
  panel.style.left=`${x}px`; panel.style.top=`${y}px`;
  panel.style.right='auto';panel.style.bottom='auto';
}
function scratchpadDragEnd(e){if(scratchpad.drag?.pointer===e.pointerId)scratchpad.drag=null;}
document.addEventListener('pointermove',scratchpadDragMove);
document.addEventListener('pointerup',scratchpadDragEnd);
document.addEventListener('pointercancel',scratchpadDragEnd);
window.addEventListener('resize',()=>{
  if (window.innerWidth <= 650) {
    const p=document.getElementById('scratch-panel');if(p){p.style.left='';p.style.right='';p.style.top='';p.style.bottom='';}
  }
  if (scratchpad.opened) requestAnimationFrame(scratchpadRedraw);
});
