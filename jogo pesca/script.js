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
  const rodlineSvg = document.getElementById('rodline');
  const lineEl = document.getElementById('line-el');

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

  // Ocean region as fractions of the stage box (matches the SVG scene: water starts ~55.5% across, horizon ~42% down)
  function playAreaBounds(){
    const r = stage.getBoundingClientRect();
    return {
      minX: r.width * 0.60,
      maxX: r.width * 0.93,
      minY: r.height * 0.48,
      maxY: r.height * 0.90
    };
  }

  function anglerAnchor(){
    const r = angler.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    // roughly the rod-tip position (upper-right area of the angler artwork)
    return { x: r.left - sr.left + r.width * 0.80, y: r.top - sr.top + r.height * 0.06 };
  }

  function spawnSpot(){
    if (!running) return;
    if (spots.length >= MAX_SPOTS) return;
    const b = playAreaBounds();
    const x = b.minX + Math.random() * (b.maxX - b.minX);
    const y = b.minY + Math.random() * (b.maxY - b.minY);

    const el = document.createElement('div');
    el.className = 'spot hot';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = '<div class="bubble b1"></div><div class="bubble b2"></div><div class="bubble b3"></div>';

    const record = { el, x, y, expireId: null };
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
    removeSpot(record);

    const anchor = anglerAnchor();
    drawLine(anchor.x, anchor.y, record.x, record.y);

    setTimeout(() => {
      if (!running) return;
      startBite(record.x, record.y);
    }, 350);
  }

  function startBite(x, y){
    const isKraken = Math.random() < KRAKEN_CHANCE;

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

    if (reeled){
      if (isKraken){
        score -= 3;
        showToast(x, y, '−3 KRAKEN!', 'bad');
      } else {
        score += 1;
        caughtCount += 1;
        showToast(x, y, '+1 PEIXE', 'good');
      }
    } else if (escaped){
      showToast(x, y, 'FUGIU...', 'neutral');
    } else {
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