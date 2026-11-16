'use strict';
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
