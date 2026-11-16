'use strict';
  // PWA works when the files are served through HTTPS or localhost; file:// still plays normally.
  if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1')){
    addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
  }
  renderHome();
