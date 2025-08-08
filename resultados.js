const API = 'https://votacion-mesaza-back.vercel.app/totalVotes';
const chart = document.getElementById('chart');
const skeletonTpl = document.getElementById('bar-skeleton');

const statusText = document.getElementById('statusText');
const countdownEl = document.getElementById('countdown');
const progressBar = document.getElementById('progressBar');

const winnerBanner = document.getElementById('winnerBanner');
const winnerImg = document.getElementById('winnerImg');
const winnerName = document.getElementById('winnerName');
const winnerVotes = document.getElementById('winnerVotes');
const winnerPct = document.getElementById('winnerPct');

const SUSPENSE_MS = 10000; // 10s
const MAX_BAR_PX = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--maxBar')) || 280;

init();

async function init(){
  renderSkeletons(6);

  let data;
  try{
    data = await fetchData();
  }catch(e){
    console.error(e);
    chart.innerHTML = `<p style="padding:16px">No pudimos cargar los resultados. Reintentá más tarde.</p>`;
    chart.setAttribute('aria-busy', 'false');
    return;
  }

  // Normalizar estructura
  data = (data || []).map(ch => ({
    id: ch.id,
    name: ch.name || 'Equipo',
    votes: Number(ch.votes || 0),
    imageUrl: ch.imageUrl || 'https://via.placeholder.com/140'
  }));

  // Crear barras base
  chart.innerHTML = '';
  data.forEach((ch, i) => chart.appendChild(createBar(ch, i)));

  chart.setAttribute('aria-busy', 'true');

  // Suspenso: 10s con jitter de barras + countdown
  statusText.textContent = 'Mostrando animación…';
  await suspenseCountdown(SUSPENSE_MS, (progress) => {
    progressBar.style.width = `${Math.min(progress * 100, 100)}%`;
    countdownEl.textContent = `${Math.ceil((1 - progress) * (SUSPENSE_MS/1000))}s`;
    jitterBars();
  });

  // Reveal real
  statusText.textContent = 'Resultados finales';
  chart.setAttribute('aria-busy', 'false');
  revealResults(data);
}

function renderSkeletons(n=6){
  chart.innerHTML = '';
  for(let i=0;i<n;i++){
    chart.appendChild(skeletonTpl.content.cloneNode(true));
  }
}

async function fetchData(){
  const res = await fetch(API, { cache: 'no-store' });
  if(!res.ok) throw new Error('Fetch error');
  return await res.json(); // [{id, name, votes, imageUrl}]
}

function createBar(chapter, index){
  const wrap = document.createElement('div');
  wrap.className = 'bar-wrapper';
  wrap.dataset.id = chapter.id;

  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.style.height = `${randInt(40, 120)}px`; // arranque random
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${chapter.name}, votos: desconocido durante animación`);

  const label = document.createElement('div');
  label.className = 'bar-label';
  label.textContent = '?';

  const meta = document.createElement('div');
  meta.className = 'bar-meta';

  const img = document.createElement('img');
  img.className = 'bar-image';
  img.src = chapter.imageUrl;
  img.alt = chapter.name;

  const name = document.createElement('div');
  name.className = 'bar-name';
  name.textContent = chapter.name;

  bar.appendChild(label);
  wrap.appendChild(bar);

  meta.appendChild(img);
  meta.appendChild(name);
  wrap.appendChild(meta);

  return wrap;
}

function jitterBars(){
  document.querySelectorAll('.bar').forEach(bar => {
    const base = parseInt(bar.style.height) || 60;
    const delta = randInt(-30, 30);
    const next = clamp(base + delta, 30, MAX_BAR_PX);
    bar.style.height = `${next}px`;
  });
}

function revealResults(data){
  // calcular total y max
  const total = data.reduce((acc, c) => acc + c.votes, 0) || 1;
  const maxVotes = Math.max(...data.map(c => c.votes), 1);

  // ordenar para saber ganador
  const byVotesDesc = [...data].sort((a,b)=> b.votes - a.votes);
  const winner = byVotesDesc[0];

  // animar cada barra a su altura final
  const wrappers = Array.from(document.querySelectorAll('.bar-wrapper'));
  const mapByName = Object.fromEntries(data.map(d => [d.name, d]));

  wrappers.forEach(wrap => {
    const name = wrap.querySelector('.bar-name').textContent;
    const d = mapByName[name];
    if(!d) return;

    const bar = wrap.querySelector('.bar');
    const label = wrap.querySelector('.bar-label');

    const height = Math.max(8, Math.round((d.votes / maxVotes) * MAX_BAR_PX));
    bar.style.height = `${height}px`;

    // al finalizar la transición, mostrar votos y % (una sola vez)
    bar.addEventListener('transitionend', () => {
      const pct = ((d.votes / total) * 100).toFixed(1);
      label.textContent = `${d.votes} (${pct}%)`;
      bar.setAttribute('aria-label', `${d.name}, votos: ${d.votes}, ${pct}%`);
    }, { once: true });
  });

  // Marcar ganador visualmente
  const winnerWrap = wrappers.find(w => w.querySelector('.bar-name').textContent === winner.name);
  if(winnerWrap){
    winnerWrap.classList.add('winner');
    dropConfetti(winnerWrap);

    // Panel ganador
    winnerBanner.hidden = false;
    winnerImg.src = winner.imageUrl;
    winnerImg.alt = winner.name;
    winnerName.textContent = winner.name;
    winnerVotes.textContent = winner.votes;
    winnerPct.textContent = ((winner.votes / total) * 100).toFixed(1) + '%';
  }
}

/* Confetti simple en el wrapper ganador */
function dropConfetti(container){
  const COLORS = ['#0A67FF', '#00AEEF', '#8FD4FF', '#ffffff', '#fbc02d'];
  const COUNT = 42;

  for(let i=0;i<COUNT;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti';
    const size = Math.random() * 8 + 6; // 6-14px
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.6}px`;
    piece.style.background = COLORS[Math.floor(Math.random()*COLORS.length)];
    piece.style.left = `${50 + (Math.random()*40 - 20)}%`; // -20% a +20% del centro
    piece.style.animationDuration = `${1.2 + Math.random()*0.9}s`;
    piece.style.animationDelay = `${Math.random()*0.2}s`;
    // trayectorias
    const x = (Math.random() * 220 - 110) + '%'; // -110% a 110%
    const r = (Math.random() * 600 - 300) + 'deg';
    piece.style.setProperty('--x', x);
    piece.style.setProperty('--r', r);
    container.appendChild(piece);
  }

  // limpiar piezas luego de ~2.4s
  setTimeout(()=>{
    container.querySelectorAll('.confetti').forEach(el => el.remove());
  }, 2400);
}

/* Utilitarios */
function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function suspenseCountdown(ms, onTick){
  return new Promise(resolve => {
    const start = performance.now();
    const tick = (t) => {
      const elapsed = t - start;
      const progress = clamp(elapsed / ms, 0, 1);
      onTick?.(progress);
      if(progress < 1){
        // jitter cada ~180ms
        setTimeout(()=> requestAnimationFrame(tick), 180);
      }else{
        progressBar.style.width = '100%';
        countdownEl.textContent = '0s';
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}