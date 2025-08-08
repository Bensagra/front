const API_BASE = 'https://votacion-mesaza-back.vercel.app';
const VOTE_KEY = 'voted:global'; // guarda { chapterId, ts }

const packsEl = document.getElementById('packs');
const skeletonTpl = document.getElementById('pack-skeleton');

init();

async function init(){
  renderSkeletons(3);
  try{
    await loadFoods();
  }catch(err){
    console.error(err);
    packsEl.innerHTML = errorCard();
  }
}

function renderSkeletons(n=2){
  packsEl.innerHTML = '';
  for(let i=0;i<n;i++){
    packsEl.appendChild(skeletonTpl.content.cloneNode(true));
  }
}

function errorCard(){
  return `
    <div class="pack">
      <div class="border-anim"></div>
      <div style="text-align:left">
        <div style="font-weight:700">No pudimos cargar los packs</div>
        <div style="color:#6b7280">Reintentá en unos segundos</div>
      </div>
      <button class="btn" onclick="location.reload()">Reintentar</button>
    </div>`;
}

function getSavedVote(){
  try { return JSON.parse(localStorage.getItem(VOTE_KEY) || 'null'); }
  catch { return null; }
}
function saveVote(chapterId){
  localStorage.setItem(VOTE_KEY, JSON.stringify({ chapterId, ts: Date.now() }));
}

async function loadFoods() {
  const res = await fetch(`${API_BASE}/food`, { cache: 'no-store' });
  if(!res.ok) throw new Error('Error al cargar foods');
  const data = await res.json();

  packsEl.innerHTML = '';

  const saved = getSavedVote();

  data.forEach((chapter, idx) => {
    const pack = document.createElement('div');
    pack.className = 'pack';

    // Badge con número
    const badge = document.createElement('div');
    badge.className = 'pack-badge';
    badge.textContent = `Pack ${idx + 1}`;
    pack.appendChild(badge);

    // Borde animado
    const borderFx = document.createElement('div');
    borderFx.className = 'border-anim';
    pack.appendChild(borderFx);

    // Grilla de comidas
    const foodsList = document.createElement('div');
    foodsList.className = 'foods';

    (chapter.foods || []).forEach(food => {
      const foodDiv = document.createElement('div');
      foodDiv.className = 'food';

      const imgWrap = document.createElement('div');
      imgWrap.className = 'img';

      const img = document.createElement('img');
      img.src = food.imageUrl;
      img.alt = food.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';

      imgWrap.appendChild(img);

      const p = document.createElement('p');
      p.textContent = food.name;

      foodDiv.appendChild(imgWrap);
      foodDiv.appendChild(p);
      foodsList.appendChild(foodDiv);
    });

    // Botón votar
    const voteButton = document.createElement('button');
    voteButton.className = 'btn';
    voteButton.type = 'button';
    voteButton.textContent = 'Votar este pack';

    // Estado si ya hay voto guardado
    if(saved){
      if(saved.chapterId === chapter.id){
        voteButton.disabled = true;
        voteButton.textContent = 'Voto registrado';
        pack.classList.add('voted');
      }else{
        voteButton.disabled = true;
        pack.classList.add('locked');
      }
    }

    voteButton.onclick = async () => {
      const already = getSavedVote();
      if(already){
        // ya votó, no permitir más
        return;
      }

      const ok = confirm(`¿Confirmás tu voto para el Pack ${idx + 1}?`);
      if(!ok) return;

      voteButton.disabled = true;

      try{
        const r = await fetch(`${API_BASE}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterId: chapter.id }),
        });
        if(!r.ok) throw new Error('Error al votar');

        // Guardar voto global
        saveVote(chapter.id);

        // Bloquear todos los packs y marcar el elegido
        lockAllPacks(pack);
        voteButton.textContent = 'Voto registrado';

        // Celebración
        celebrate(pack);

      }catch(e){
        console.error(e);
        voteButton.disabled = false;
        alert('No pudimos registrar el voto. Probá de nuevo.');
      }
    };

    pack.appendChild(foodsList);
    pack.appendChild(voteButton);
    packsEl.appendChild(pack);
  });
}

/** Deshabilita todos los botones y marca el pack elegido como "voted" */
function lockAllPacks(selectedPack){
  document.querySelectorAll('.pack').forEach(pk =>{
    const btn = pk.querySelector('.btn');
    if(btn) btn.disabled = true;
    if(pk === selectedPack){
      pk.classList.add('voted');
    }else{
      pk.classList.add('locked');
    }
  });
}

/** Animación de celebración: glow + confetti */
function celebrate(pack){
  // Glow
  const glow = document.createElement('div');
  glow.className = 'celebrate-glow';
  pack.appendChild(glow);

  // Confetti
  const COLORS = ['#0A67FF', '#00AEEF', '#8FD4FF', '#ffffff', '#1B84FF'];
  const COUNT = 36;

  for(let i=0;i<COUNT;i++){
    const piece = document.createElement('div');
    piece.className = 'confetti';
    const size = Math.random() * 8 + 6; // 6-14px
    piece.style.width = `${size}px`;
    piece.style.height = `${size * 0.6}px`;
    piece.style.background = COLORS[Math.floor(Math.random()*COLORS.length)];
    piece.style.left = `${50 + (Math.random()*40 - 20)}%`; // -20% a +20% del centro
    piece.style.animationDuration = `${1.2 + Math.random()*0.8}s`;
    piece.style.animationDelay = `${Math.random()*0.2}s`;
    // trayectorias
    const x = (Math.random() * 220 - 110) + '%'; // -110% a 110%
    const r = (Math.random() * 600 - 300) + 'deg';
    piece.style.setProperty('--x', x);
    piece.style.setProperty('--r', r);
    pack.appendChild(piece);
  }

  // Cleanup confetti y glow
  setTimeout(()=>{
    glow.remove();
    pack.querySelectorAll('.confetti').forEach(el => el.remove());
  }, 2200);
}