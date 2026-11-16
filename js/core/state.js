'use strict';
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const app = $('#app');
  const fxCanvas = $('#fx');
  const fxCtx = fxCanvas.getContext('2d');
  const modeRegistry = new Map();
  const STORAGE_KEY = 'gsat-speed-lab-v1';
  const DEFAULT_SETTINGS = {questionCount:10, answerStyle:'choice', tablePreset:'mixed', tableOptions:2, reasoningStyle:'mixed', divisionLevel:'mixed', sound:true, haptics:true};
  const defaultData = () => ({ settings:{...DEFAULT_SETTINGS}, records:[], totalRight:0, totalAnswered:0, bestCombo:0, wrongBank:{}, modeStats:{}, feverRecords:[], feverBest:{} });
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
  let feverRaf=0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadState(){
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(!raw || typeof raw !== 'object') return defaultData();
      return {...defaultData(), ...raw,settings:{...DEFAULT_SETTINGS,...raw.settings},records:Array.isArray(raw.records)?raw.records:[],wrongBank:raw.wrongBank&&typeof raw.wrongBank==='object'?raw.wrongBank:{},modeStats:raw.modeStats&&typeof raw.modeStats==='object'?raw.modeStats:{},feverRecords:Array.isArray(raw.feverRecords)?raw.feverRecords:[],feverBest:raw.feverBest&&typeof raw.feverBest==='object'?raw.feverBest:{}};
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
  window.GSATLab={registerMode, listModes:()=>[...modeRegistry.keys()],version:'1.8.0'};
