(function(){
  "use strict";
 
  const stage = document.getElementById('stage');
  const scoreVal = document.getElementById('score-val');
  const timeVal = document.getElementById('time-val');
  const timeChip = document.getElementById('time-chip');
  const startOverlay = document.getElementById('start-overlay');
  const endOverlay = document.getElementById('end-overlay');
  const finalScore = document.getElementById('final-score');
  const finalCaught = document.getElementById('final-caught');
  const angler = document.getElementById('angler');
  const anglerImg = document.getElementById('angler-img');
  const rodlineSvg = document.getElementById('rodline');
  const lineEl = document.getElementById('line-el');
 
  // Poses do personagem: cada uma tem sua própria imagem e o deslocamento (left)
  // necessário para manter os pés alinhados ao ponto-âncora #angler.
  const POSES = {
    idle: { src: 'angler-idle.png', left: -39 },
    cast: { src: 'angler-cast.png', left: -88 },
    pull: { src: 'angler-pull.png', left: -125 }
  };
  let pullResetId = null;
 
  function setPose(name){
    const cfg = POSES[name];
    if (!cfg) return;
    anglerImg.src = cfg.src;
    anglerImg.className = 'pose-' + name;
    anglerImg.style.left = cfg.left + 'px';
  }
 
  const biteCard = document.getElementById('bite-card');
  const biteShadow = document.getElementById('bite-shadow');
  const biteTimerFill = document.getElementById('bite-timer-fill');
  const btnReel = document.getElementById('btn-reel');
  const btnRelease = document.getElementById('btn-release');
 
  const GAME_SECONDS = 120;
  const REEL_WINDOW_MS = 5000;
  const KRAKEN_CHANCE = 0.22;
  const SPOT_LIFETIME_MS = 6500;
  const MAX_SPOTS = 3;
  const SPAWN_INTERVAL_MS = 1400;
 
  let score = 0;
  let caughtCount = 0;
  let timeLeft = GAME_SECONDS;
  let running = false;
  let spots = [];
  let spawnTimer = null;
  let clockTimer = null;
  let activeBite = null;
 
  // Região do oceano como frações da caixa do palco (corresponde à cena SVG: a água começa em ~55,5% na horizontal, o horizonte em ~42% na vertical)
  function playAreaBounds(){
    const r = stage.getBoundingClientRect();
    return {
    minX: r.width * 0.60,
    maxX: r.width * 0.93,
    minY: r.height * 0.62,   
    maxY: r.height * 0.90
    };
  }
 
  function anglerAnchor(){
    // #angler tem tamanho zero e marca o ponto no chão onde os pés do personagem ficam.
    // A partir dele, aplicamos o deslocamento fixo até a ponta da vara na pose "cast"
    // (medido na própria arte do personagem lançando a linha).
    const r = angler.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    return { x: (r.left - sr.left) + 93, y: (r.top - sr.top) - 134 };
  }
 
  function spawnSpot(){
    if (!running) return;
    if (spots.length >= MAX_SPOTS) return;
    const b = playAreaBounds();
    const x = b.minX + Math.random() * (b.maxX - b.minX);
    const y = b.minY + Math.random() * (b.maxY - b.minY);
    const isKraken = Math.random() < KRAKEN_CHANCE;
 
    const el = document.createElement('div');
    el.className = 'spot hot';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = isKraken
      ? '<div class="bubble b1"></div><div class="bubble b2"></div><div class="bubble b3"></div><div class="bubble b4"></div>'
      : '<div class="bubble b1"></div><div class="bubble b2"></div><div class="bubble b3"></div>';
 
    const record = { el, x, y, isKraken, expireId: null };
    el.addEventListener('click', () => castTo(record));
    stage.appendChild(el);
 
    record.expireId = setTimeout(() => removeSpot(record), SPOT_LIFETIME_MS);
    spots.push(record);
  }
 
  function removeSpot(record){
    const idx = spots.indexOf(record);
    if (idx !== -1) spots.splice(idx, 1);
    if (record.el && record.el.parentNode) record.el.parentNode.removeChild(record.el);
    if (record.expireId) clearTimeout(record.expireId);
  }
 
  function drawLine(x1,y1,x2,y2){
    lineEl.setAttribute('x1', x1);
    lineEl.setAttribute('y1', y1);
    lineEl.setAttribute('x2', x2);
    lineEl.setAttribute('y2', y2);
    rodlineSvg.style.display = 'block';
  }
 
  function hideLine(){ rodlineSvg.style.display = 'none'; }
 
  function castTo(record){
    if (!running || activeBite) return;
    const isKraken = record.isKraken;
    removeSpot(record);
 
    setPose('cast');
    const anchor = anglerAnchor();
    drawLine(anchor.x, anchor.y, record.x, record.y);
 
    setTimeout(() => {
      if (!running) return;
      startBite(record.x, record.y, isKraken);
    }, 350);
  }
 
  function startBite(x, y, isKraken){
    biteShadow.classList.toggle('suspicious', isKraken);
    biteCard.style.left = x + 'px';
    biteCard.style.top = y + 'px';
    biteCard.classList.add('show');
 
    biteTimerFill.style.transition = 'none';
    biteTimerFill.style.transform = 'scaleX(1)';
    void biteTimerFill.offsetWidth;
    biteTimerFill.style.transition = `transform ${REEL_WINDOW_MS}ms linear`;
    biteTimerFill.style.transform = 'scaleX(0)';
 
    const timeoutId = setTimeout(() => resolveBite(false, true), REEL_WINDOW_MS);
    activeBite = { isKraken, x, y, timeoutId };
  }
 
  function resolveBite(reeled, escaped){
    if (!activeBite) return;
    clearTimeout(activeBite.timeoutId);
    const { isKraken, x, y } = activeBite;
    biteCard.classList.remove('show');
    hideLine();
    if (pullResetId) clearTimeout(pullResetId);
 
    if (reeled){
      setPose('pull');
      pullResetId = setTimeout(() => setPose('idle'), 450);
      if (isKraken){
        score -= 3;
        showToast(x, y, '−3 KRAKEN!', 'bad');
        showCaughtKraken(x, y);
      } else {
        score += 1;
        caughtCount += 1;
        showToast(x, y, '+1 PEIXE', 'good');
        showCaughtFish(x, y);
      }
    } else if (escaped){
      setPose('idle');
      showToast(x, y, 'FUGIU...', 'neutral');
    } else {
      setPose('idle');
      showToast(x, y, 'SOLTO', 'neutral');
    }
 
    scoreVal.textContent = score;
    activeBite = null;
  }
 
  function showToast(x, y, text, kind){
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = text;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
    stage.appendChild(t);
    setTimeout(() => t.remove(), 950);
  }

  function showCaughtFish(x, y){
    const f = document.createElement('img');
    f.src = 'peixe 1.png';
    f.className = 'catch-fish';
    f.alt = '';
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    stage.appendChild(f);
    setTimeout(() => f.remove(), 900);
  }

  function showCaughtKraken(x, y){
    const k = document.createElement('img');
    k.src = 'kraken 1.png';
    k.className = 'catch-kraken';
    k.alt = '';
    k.style.left = x + 'px';
    k.style.top = y + 'px';
    stage.appendChild(k);
    setTimeout(() => k.remove(), 900);
  }
 
  btnReel.addEventListener('click', () => resolveBite(true, false));
  btnRelease.addEventListener('click', () => resolveBite(false, false));
 
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (activeBite) resolveBite(true, false);
  });
 
  function tick(){
    timeLeft -= 1;
    const m = Math.floor(timeLeft / 60);
    const s = String(timeLeft % 60).padStart(2,'0');
    timeVal.textContent = `${m}:${s}`;
    timeChip.classList.toggle('warn', timeLeft <= 15);
    if (timeLeft <= 0) endGame();
  }
 
  function startGame(){
    score = 0; caughtCount = 0; timeLeft = GAME_SECONDS;
    scoreVal.textContent = '0';
    timeVal.textContent = '2:00';
    timeChip.classList.remove('warn');
    spots.forEach(removeSpot);
    spots = [];
    activeBite = null;
    biteCard.classList.remove('show');
    hideLine();
    if (pullResetId) clearTimeout(pullResetId);
    setPose('idle');
    running = true;
 
    startOverlay.classList.add('hidden');
    endOverlay.classList.add('hidden');
 
    spawnSpot();
    spawnTimer = setInterval(spawnSpot, SPAWN_INTERVAL_MS);
    clockTimer = setInterval(tick, 1000);
  }
 
  function endGame(){
    running = false;
    clearInterval(spawnTimer);
    clearInterval(clockTimer);
    spots.forEach(removeSpot);
    spots = [];
    if (activeBite){
      clearTimeout(activeBite.timeoutId);
      activeBite = null;
      biteCard.classList.remove('show');
      hideLine();
    }
    finalScore.textContent = score;
    finalCaught.textContent = caughtCount + (caughtCount === 1 ? ' peixe capturado' : ' peixes capturados');
    endOverlay.classList.remove('hidden');
  }
 
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
 
})();