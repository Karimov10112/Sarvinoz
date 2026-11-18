/* Yulduzlardan yasalgan tug'ilgan kun tabrigi
   Barcha matn va suratlar config.json faylida — bu yerga tegish shart emas. */
(async () => {
  // ---------- Sozlamalar ----------
  const DEFAULT = {
    ism: 'Ismi',
    kimdan: "Do'sting",
    sozlar: ['Aqlli', 'Faol', 'Notiq', 'Ilhomlantiruvchi'],
    tabrik: "Tug'ilgan kuning muborak! 🎉",
    asosiyRasm: '',
    rasmlar: [],
    musiqa: '',
  };
  let C = DEFAULT;
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
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
    requestAnimationFrame(frame);
  }

  // ---------- 3D galereya ----------
  const ring = $('ring'), stage = $('stage');
  let galleryOn = false, angle = 0, vel = 0.15, radius = 300, gImgs = [];
  function buildRing() {
    ring.innerHTML = '';
    gImgs.forEach((g) => {
      const el = document.createElement('div');
      el.className = 'gcard';
      el.innerHTML = `<img src="${g.img.src}" alt="">` + (g.izoh ? `<div class="cap"></div>` : '');
      if (g.izoh) el.querySelector('.cap').textContent = g.izoh;
      el.dataset.i = gImgs.indexOf(g);
      ring.appendChild(el);
    });
    layoutRing();
  }
  function layoutRing() {
    const n = Math.max(gImgs.length, 3);
    const cw = Math.min(190, W * 0.36), ch = cw * 1.3;
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
        show(() => assign(textPoints(n, mainBox()))); await S(950);
        explode(); await S(220);
      }
      show(() => assign(textPoints(C.ism, mainBox()))); await S(2900);
      explode(); await S(650);

      for (const w of C.sozlar) {
        show(() => assign(textPoints(w, mainBox()))); await S(1550);
        explode(); await S(380);
      }

      // Asosiy surat: zarrachalardan yig'iladi
      if (mainImg) {
        hero.src = mainImg.src;
        show(() => {
          const r = photoPoints(mainImg, { cx: W / 2, cy: H / 2, maxW: W * 0.8, maxH: H * 0.66 });
          assign(r);
          Object.assign(hero.style, { left: r.rect.x + 'px', top: r.rect.y + 'px', width: r.rect.w + 'px', height: r.rect.h + 'px' });
        });
        await S(2800);
        hero.classList.add('on'); await S(3000);
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
      for (let i = 0; i < 4; i++) setTimeout(randomLaunch, 300 + i * 450);
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

  const btn = $('startBtn');
  btn.disabled = false; btn.textContent = 'Ochish ✨';
  btn.addEventListener('click', () => {
    $('start').classList.remove('on');
    if (audio) audio.play().catch(() => {});
    run();
  });
})();
