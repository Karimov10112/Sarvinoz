/* Yulduzlardan yasalgan tug'ilgan kun tabrigi
   Barcha matn va suratlar config.json faylida — bu yerga tegish shart emas. */
(async () => {
  // ---------- Sozlamalar ----------
  const DEFAULT = {
    ism: 'Ismi',
    kimdan: "Do'sting",
    sozlar: [],
    tabrik: "Tug'ilgan kuning muborak! 🎉",
    asosiyRasm: '',
    rasmlar: [],
    musiqa: '',
  };
  let C = DEFAULT;
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) {
      C = Object.assign({}, DEFAULT, await res.json());
    }
  } catch (e) {
    console.warn('config.json o\'qilmadi, standart qiymatlar ishlatiladi', e);
  }

  const $ = (id) => document.getElementById(id);
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
  const cv = $('c');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, N = 0;
  let mode = 'text';          // 'text' | 'photo'
  let current = null;         // joriy shaklni qayta chizish funksiyasi (ekran o'lchami o'zgarsa)
  let finalMode = false;
  let runId = 0;

  // ---------- Rasmlarni oldindan yuklash ----------
  const loadImg = (src) => new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    const timer = setTimeout(() => {
      console.warn('Rasm yuklash vaqti tugadi:', src);
      res(null);
    }, 3500);
    im.onload = () => { clearTimeout(timer); res(im); };
    im.onerror = () => {
      clearTimeout(timer);
      console.warn('Rasm topilmadi yoki yuklanmadi:', src);
      res(null);
    };
    im.src = src;
  });

  // ---------- Zarrachalar ----------
  const parts = [];
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = W * H < 500000 ? 1500 : 2600;
    if (want !== N) {
      N = want;
      while (parts.length < N) parts.push(newPart());
      parts.length = N;
    }
    for (const p of parts) { p.hx = Math.random() * W; p.hy = Math.random() * H; }
    if (current) current();
    if (galleryOn) layoutRing();
  }
  function newPart() {
    const x = Math.random() * (W || innerWidth), y = Math.random() * (H || innerHeight);
    return { x, y, vx: 0, vy: 0, hx: x, hy: y, tx: null, ty: null, col: null, sz: 2,
      s: Math.random() * 1.3 + 0.5, tw: Math.random() * 6.28 };
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Matnni nuqtalarga aylantirish
  function textPoints(text, box) {
    const lines = String(text).split('\n');
    const off = document.createElement('canvas');
    off.width = Math.ceil(W); off.height = Math.ceil(H);
    const o = off.getContext('2d', { willReadFrequently: true });
    let fs = Math.min(box.maxH / (lines.length * 1.1), 240);
    o.font = `800 ${fs}px ${FONT}`;
    const mw = Math.max(...lines.map((l) => o.measureText(l).width));
    if (mw > box.maxW) fs *= box.maxW / mw;
    o.font = `800 ${fs}px ${FONT}`;
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    const lh = fs * 1.08, top = box.cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => o.fillText(l, box.cx, top + i * lh));
    const ow = off.width, oh = off.height;
    const d = o.getImageData(0, 0, ow, oh).data;
    let filled = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) filled++;
    const s = Math.max(2, Math.ceil(Math.sqrt(filled / (N * 0.92))));
    const pts = [];
    for (let y = 0; y < oh; y += s) for (let x = 0; x < ow; x += s)
      if (d[(y * ow + x) * 4 + 3] > 128) pts.push({ x, y, c: null });
    return { pts, s, photo: false };
  }

  // Suratni rangli nuqtalarga aylantirish
  function photoPoints(img, box) {
    try {
      const ar = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 0.8;
      let w = box.maxW, h = w / ar;
      if (h > box.maxH) { h = box.maxH; w = h * ar; }
      const s = Math.max(2, Math.ceil(Math.sqrt((w * h) / (N * 0.98))));
      w = Math.floor(w / s) * s; h = Math.floor(h / s) * s;
      const x0 = box.cx - w / 2, y0 = box.cy - h / 2;
      const off = document.createElement('canvas');
      off.width = w; off.height = h;
      const o = off.getContext('2d', { willReadFrequently: true });
      o.drawImage(img, 0, 0, w, h);
      const d = o.getImageData(0, 0, w, h).data;
      const pts = [];
      for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
        const i = ((y + (s >> 1)) * w + Math.min(w - 1, x + (s >> 1))) * 4;
        const ii = i < d.length ? i : (y * w + x) * 4;
        pts.push({ x: x0 + x + s / 2, y: y0 + y + s / 2, c: `rgb(${d[ii]},${d[ii + 1]},${d[ii + 2]})` });
      }
      return { pts, s, photo: true, rect: { x: x0, y: y0, w, h } };
    } catch (err) {
      console.warn('Rasm piksellarini o\'qishda xatolik:', err);
      return { pts: [], s: 2, photo: false, rect: { x: box.cx - 100, y: box.cy - 100, w: 200, h: 200 } };
    }
  }

  function assign(r) {
    mode = r.photo ? 'photo' : 'text';
    shuffle(r.pts);
    parts.forEach((p, i) => {
      const t = r.pts[i];
      if (t) {
        p.tx = t.x; p.ty = t.y;
        p.col = t.c || `hsl(${(320 + (t.x / W) * 90) % 360},100%,68%)`;
        p.sz = r.photo ? r.s * 1.02 : Math.max(1.7, r.s * 0.62);
      } else { p.tx = null; p.col = null; }
    });
  }

  function explode() {
    mode = 'text';
    for (const p of parts) {
      if (p.tx !== null) {
        const a = Math.random() * Math.PI * 2, f = Math.random() * 22 + 6;
        p.vx += Math.cos(a) * f; p.vy += Math.sin(a) * f;
      }
      p.tx = null; p.col = null;
    }
  }

  const show = (fn) => { current = fn; fn(); };
  const mainBox = () => ({ cx: W / 2, cy: H / 2, maxW: W * 0.88, maxH: H * 0.5 });

  // ---------- Kursor / barmoq bilan zarrachalarni itarish ----------
  const ptr = { x: 0, y: 0, on: false, t: 0 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.t = performance.now(); });
  addEventListener('pointerdown', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.t = performance.now(); });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') ptr.on = false; });
  addEventListener('pointercancel', () => { ptr.on = false; });
  document.addEventListener('mouseleave', () => { ptr.on = false; });

  // ---------- Salyut ----------
  const rockets = [], sparks = [];
  function launch(x, y) {
    rockets.push({ x, y: H + 10, ty: y, h: Math.random() * 360, sp: Math.max(9, (H - y) / 38) });
  }
  function randomLaunch() { launch(W * (0.15 + Math.random() * 0.7), H * (0.12 + Math.random() * 0.35)); }
  function burst(x, y, h) {
    const n = 80 + ((Math.random() * 40) | 0);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 5 + 1.2;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, h: h + Math.random() * 40 - 20 });
    }
  }
  function drawFireworks() {
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y -= r.sp;
      ctx.fillStyle = `hsl(${r.h},100%,75%)`;
      ctx.fillRect(r.x - 1.5, r.y, 3, 10);
      if (r.y <= r.ty) { burst(r.x, r.y, r.h); rockets.splice(i, 1); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vy += 0.06; s.vx *= 0.985; s.vy *= 0.985;
      s.x += s.vx; s.y += s.vy; s.life -= 0.011;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.fillStyle = `hsla(${s.h},100%,65%,${s.life.toFixed(2)})`;
      ctx.fillRect(s.x - 1.2, s.y - 1.2, 2.4, 2.4);
    }
  }

  // ---------- Zarba to'lqini va konfetti ----------
  const waves = [], confetti = [];
  let flash = 0;
  function shock(x, y, hue = 330) {
    waves.push({ x, y, r: 10, a: 1, h: hue }, { x, y, r: 0, a: 0.7, h: hue + 40 });
    flash = 0.22;
    for (const p of parts) {
      const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
      if (p.tx === null) { const f = Math.max(0, 14 - d / 40); p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
    }
  }
  const CCOLS = ['#ff4fa3', '#ffd36e', '#7ad7ff', '#b892ff', '#7dffb2', '#ffffff', '#ff8a5c'];
  function addConfetti(n, fromTop = true) {
    for (let i = 0; i < n; i++) confetti.push({
      x: Math.random() * W, y: fromTop ? -20 - Math.random() * H * 0.6 : H * 0.5,
      vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2 + 1.5,
      w: Math.random() * 6 + 5, h: Math.random() * 4 + 3, r: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.25, sw: Math.random() * 6.28, c: CCOLS[(Math.random() * CCOLS.length) | 0],
    });
  }
  function drawFx() {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.r += 9 + w.r * 0.035; w.a -= 0.018;
      if (w.a <= 0) { waves.splice(i, 1); continue; }
      ctx.strokeStyle = `hsla(${w.h},100%,70%,${w.a.toFixed(2)})`;
      ctx.lineWidth = 3 + w.a * 5;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
    }
    if (flash > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(255,200,235,${flash.toFixed(2)})`); g.addColorStop(1, 'rgba(255,120,200,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); flash *= 0.9;
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i];
      c.sw += 0.05; c.x += c.vx + Math.sin(c.sw) * 0.8; c.y += c.vy; c.r += c.vr;
      if (c.y > H + 30) { confetti.splice(i, 1); continue; }
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
      ctx.scale(1, Math.cos(c.sw * 2)); ctx.fillStyle = c.c;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
    }
  }

  // ---------- Musiqa (fayl bo'lmasa, brauzerning o'zida "music box" chalinadi) ----------
  let actx = null, master = null, musicOn = true, musicTimer = null;
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // Happy Birthday (xalq mulki): [midi nota, zarb davomiyligi]
  const SONG = [[67,.75],[67,.25],[69,1],[67,1],[72,1],[71,2],[67,.75],[67,.25],[69,1],[67,1],[74,1],[72,2],
    [67,.75],[67,.25],[79,1],[76,1],[72,1],[71,1],[69,2],[77,.75],[77,.25],[76,1],[72,1],[74,1],[72,3]];
  const BASS = [[48,3],[55,3],[55,3],[48,3],[48,3],[53,3],[48,3],[55,1.5],[48,1.5]];
  function initAudio() {
    if (actx) return;
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = 0.55;
      const delay = actx.createDelay(), fb = actx.createGain(), wet = actx.createGain();
      delay.delayTime.value = 0.32; fb.gain.value = 0.33; wet.gain.value = 0.35;
      master.connect(actx.destination); master.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(actx.destination);
    } catch (e) { actx = null; }
  }
  function bell(t, freq, dur, vol) {
    [[1, 1], [2, 0.35], [3.01, 0.12]].forEach(([m, v]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function playSong() {
    if (!actx || !musicOn) return;
    const beat = 0.5; let t = actx.currentTime + 0.1, tb = t;
    for (const [n, d] of SONG) { bell(t, NOTE(n), Math.max(1.2, d * beat * 2), 0.22); t += d * beat; }
    for (const [n, d] of BASS) { bell(tb, NOTE(n), d * beat * 1.5, 0.1); tb += d * beat; }
    musicTimer = setTimeout(playSong, (t - actx.currentTime + 2.5) * 1000);
  }
  function sfx(type) {
    if (!actx || !musicOn) return;
    const t = actx.currentTime;
    if (type === 'tick') bell(t, NOTE(84), 0.4, 0.12);
    if (type === 'boom') {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.6);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.75);
      [72, 76, 79, 84].forEach((n, i) => bell(t + i * 0.06, NOTE(n), 1.6, 0.12));
    }
  }
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

  // ---------- Asosiy chizish sikli ----------
  function frame(t) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = mode === 'photo' ? 'rgba(5,3,15,0.55)' : 'rgba(5,3,15,0.24)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = mode === 'photo' ? 'source-over' : 'lighter';
    const R = Math.min(W, H) * 0.13, R2 = R * R;
    const repel = ptr.on && t - ptr.t < 1500; // faqat kursor/barmoq harakatlanganda
    for (const p of parts) {
      const has = p.tx !== null;
      const tx = has ? p.tx : p.hx, ty = has ? p.ty : p.hy, k = has ? 0.022 : 0.0015;
      p.vx += (tx - p.x) * k; p.vy += (ty - p.y) * k;
      if (repel) {
        const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 5; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      }
      p.vx *= 0.86; p.vy *= 0.86; p.x += p.vx; p.y += p.vy;
      if (has) {
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
      } else {
        const a = 0.22 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.0015 + p.tw));
        ctx.fillStyle = `rgba(210,215,255,${a.toFixed(2)})`;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    drawFireworks();
    drawFx();
    if (finalMode && confetti.length < 90 && Math.random() < 0.25) addConfetti(1);
    requestAnimationFrame(frame);
  }

  // ---------- 3D galereya ----------
  const ring = $('ring'), stage = $('stage');
  let galleryOn = false, angle = 0, vel = 0.15, radius = 300, gImgs = [];
  function buildRing() {
    ring.innerHTML = '';
    // Suratlar kam bo'lsa, halqa bo'sh ko'rinmasligi uchun takrorlanadi
    const idx = [];
    while (idx.length < 6 || idx.length % gImgs.length) idx.push(idx.length % gImgs.length);
    idx.forEach((gi) => {
      const g = gImgs[gi];
      const el = document.createElement('div');
      el.className = 'gcard';
      el.innerHTML = `<img src="${g.img.src}" alt="">` + (g.izoh ? `<div class="cap"></div>` : '');
      if (g.izoh) el.querySelector('.cap').textContent = g.izoh;
      el.dataset.i = gi;
      ring.appendChild(el);
    });
    layoutRing();
  }
  function layoutRing() {
    const n = Math.max(ring.children.length, 3);
    const cw = Math.min(190, W * 0.3), ch = cw * 1.3;
    ring.style.setProperty('--cw', cw + 'px');
    ring.style.setProperty('--ch', ch + 'px');
    radius = cw / 2 / Math.tan(Math.PI / n) + 28;
    [...ring.children].forEach((el, i) => {
      el.style.transform = `rotateY(${(i * 360) / n}deg) translateZ(${radius}px)`;
    });
  }
  function spin() {
    if (!galleryOn) return;
    if (!drag) { vel += (0.15 - vel) * 0.02; angle += vel; }
    ring.style.transform = `translateZ(${-radius}px) rotateY(${angle}deg)`;
    requestAnimationFrame(spin);
  }
  let drag = false, lastX = 0, moved = 0;
  stage.addEventListener('pointerdown', (e) => { drag = true; lastX = e.clientX; moved = 0; stage.classList.add('drag'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    angle += dx * 0.35; vel = dx * 0.35;
  });
  stage.addEventListener('pointerup', (e) => {
    drag = false; stage.classList.remove('drag');
    if (moved < 6) {
      const hit = document.elementsFromPoint(e.clientX, e.clientY);
      const el = hit.find((n) => n.classList && n.classList.contains('gcard')) ||
                 (hit[0] && hit[0].closest && hit[0].closest('.gcard'));
      if (el) openLb(gImgs[+el.dataset.i]);
    }
  });
  function openLb(g) { $('lbImg').src = g.img.src; $('lbCap').textContent = g.izoh || ''; $('lb').classList.add('on'); }
  $('lb').addEventListener('click', () => $('lb').classList.remove('on'));

  let galleryDone = null;
  $('gNext').addEventListener('click', () => galleryDone && galleryDone());

  // ---------- Ketma-ketlik ----------
  const sleep = (ms, id) => new Promise((res, rej) => setTimeout(() => (id === runId ? res() : rej('stop')), ms));
  let fwTimer = null, typeTimer = null;
  const hero = $('hero');

  function resetUI() {
    finalMode = false;
    clearInterval(fwTimer); clearTimeout(typeTimer);
    ['card', 'tapHint', 'gallery', 'lb'].forEach((id) => $(id).classList.remove('on'));
    $('sign').classList.remove('on');
    hero.classList.remove('on');
    galleryOn = false;
    galleryDone = null;
  }

  async function run() {
    const id = ++runId;
    const S = (ms) => sleep(ms, id);
    resetUI();
    try {
      for (const n of ['3', '2', '1']) {
        show(() => assign(textPoints(n, mainBox()))); sfx('tick'); buzz(25); await S(950);
        explode(); await S(220);
      }
      show(() => assign(textPoints(C.ism, mainBox()))); await S(900);
      shock(W / 2, H / 2); sfx('boom'); buzz([40, 60, 40]);
      setTimeout(() => { launch(W * 0.2, H * 0.25); launch(W * 0.8, H * 0.22); }, 200);
      await S(2600);
      explode(); await S(650);

      for (const w of (C.sozlar || [])) {
        show(() => assign(textPoints(w, mainBox()))); await S(1550);
        explode(); await S(380);
      }

      show(() => assign(textPoints('Bugun —\nsening kuning', mainBox()))); await S(2300);
      explode(); await S(500);

      // Asosiy surat: zarrachalardan yig'iladi
      if (mainImg) {
        hero.src = mainImg.src;
        show(() => {
          const r = photoPoints(mainImg, { cx: W / 2, cy: H / 2, maxW: W * 0.8, maxH: H * 0.66 });
          assign(r);
          Object.assign(hero.style, { left: r.rect.x + 'px', top: r.rect.y + 'px', width: r.rect.w + 'px', height: r.rect.h + 'px' });
        });
        await S(2800);
        hero.classList.add('on'); shock(W / 2, H / 2, 40); await S(3600);
        hero.classList.remove('on'); await S(500);
        current = null; explode(); await S(800);
      }

      // Galereya
      if (gImgs.length) {
        current = null;
        galleryOn = true; buildRing(); spin();
        $('gallery').classList.add('on');
        await new Promise((res) => { galleryDone = res; });
        await S(0);
        $('gallery').classList.remove('on'); $('lb').classList.remove('on');
        await S(700); galleryOn = false;
      }

      // Tabrik + salyut
      show(() => assign(textPoints("Tug'ilgan\nkuning\nmuborak!", mainBox())));
      setTimeout(() => { shock(W / 2, H / 2, 300); sfx('boom'); buzz([60, 80, 60]); addConfetti(220); }, 1100);
      for (let i = 0; i < 7; i++) setTimeout(randomLaunch, 900 + i * 300);
      await S(3800);
      explode(); await S(600);

      // Yakun
      finalMode = true;
      show(() => assign(textPoints(C.ism, { cx: W / 2, cy: H * 0.2, maxW: W * 0.85, maxH: H * 0.22 })));
      fwTimer = setInterval(randomLaunch, 1100);
      await S(900);
      $('card').classList.add('on'); $('tapHint').classList.add('on');
      typeText(C.tabrik, id);
    } catch (e) {
      if (e !== 'stop') console.error('Ketma-ketlikda xatolik:', e);
    }
  }

  function typeText(text, id) {
    const el = $('msg'); const chars = [...text]; let i = 0;
    el.textContent = ''; el.classList.remove('done');
    const step = () => {
      if (id !== runId) return;
      el.textContent += chars[i++] || '';
      if (i < chars.length) typeTimer = setTimeout(step, chars[i - 1] === '.' || chars[i - 1] === '!' ? 260 : 38);
      else { el.classList.add('done'); $('sign').textContent = '— ' + C.kimdan; $('sign').classList.add('on'); }
    };
    step();
  }

  // Yakuniy ekranda bosilgan joyda salyut
  addEventListener('pointerdown', (e) => {
    if (!finalMode || e.target.closest('.card')) return;
    launch(e.clientX, e.clientY);
  });
  $('fwBtn').addEventListener('click', () => { for (let i = 0; i < 6; i++) setTimeout(randomLaunch, i * 180); });
  $('againBtn').addEventListener('click', () => { current = null; explode(); run(); });

  // ---------- Ishga tushirish ----------
  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);

  const [mainImg, ...rest] = await Promise.all([
    loadImg(C.asosiyRasm),
    ...(C.rasmlar || []).map((r) => loadImg(typeof r === 'string' ? r : r.fayl)),
  ]);
  gImgs = (C.rasmlar || [])
    .map((r, i) => ({ img: rest[i], izoh: typeof r === 'string' ? '' : r.izoh || '' }))
    .filter((g) => g.img);

  let audio = null;
  if (C.musiqa) { audio = new Audio(C.musiqa); audio.loop = true; }
  if (C.ism) document.title = C.ism + " uchun kichik sovg'a 🎁";

  const muteBtn = $('mute');
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    musicOn = !musicOn; muteBtn.textContent = musicOn ? '🔊' : '🔇';
    if (audio) { musicOn ? audio.play().catch(() => {}) : audio.pause(); }
    else if (actx) { master.gain.value = musicOn ? 0.55 : 0; clearTimeout(musicTimer); if (musicOn) playSong(); }
  });

  const btn = $('startBtn');
  btn.disabled = false; btn.textContent = 'Ochish ✨';
  let opened = false;
  btn.addEventListener('click', async () => {
    if (opened) return; opened = true;
    if (audio) audio.play().catch(() => {});
    else { initAudio(); if (actx && actx.resume) actx.resume(); playSong(); }
    $('start').classList.add('opening');
    buzz(30);
    const g = $('gift').getBoundingClientRect();
    setTimeout(() => {
      const x = g.left + g.width / 2, y = g.top + g.height / 2;
      shock(x, y, 320); burst(x, y, 330); burst(x, y, 45); addConfetti(120);
    }, 650);
    setTimeout(() => { $('start').classList.remove('on'); muteBtn.classList.add('on'); }, 900);
    setTimeout(run, 1500);
  });
})();
