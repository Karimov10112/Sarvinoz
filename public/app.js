/* Yulduzlardan yasalgan tug'ilgan kun tabrigi
   Barcha matn va suratlar config.json faylida — bu yerga tegish shart emas. */
(async () => {
  // ---------- Sozlamalar ----------
  const DEFAULT = {
    ism: 'Ismi',
    kimdan: "Akangiz",
    sozlar: [],
    tabrik: "Tug'ilgan kuningiz muborak! 🎉",
    asosiyRasm: '',
    rasmlar: [],
    musiqa: '',
    yosh: '',
    sana: '',
    ovozliTabrik: '',
    tilaklar: ["Sog'lik 💪", 'Omad 🍀', 'Baxt 😊', 'Kulgi 😄'],
    sirliQutilar: ['Siz zo\'rsiz! 🌟', 'Bugun hamma narsa siz uchun 🎉', 'Har doim shunday kulib yuring 🌼'],
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
  // Yakun rejimida sovg'a qutisi umuman ko'rsatilmaydi — to'g'ridan-to'g'ri yakun sahifasi ochiladi
  const memMode = !!C.xotira && !/[?&]tabrik\b/.test(location.search);
  if (!memMode) $('start').classList.add('on');
  const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
  const cv = $('c');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, N = 0;
  let mode = 'text';          // 'text' | 'photo'
  let current = null;         // joriy shaklni qayta chizish funksiyasi (ekran o'lchami o'zgarsa)
  let finalMode = false, petalRain = false;
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
  // Nafis shriftlar: ism — qo'lyozma, qolgan yozuvlar — klassik serif
  const FONTS = {
    script: (fs) => `400 ${fs}px 'Great Vibes', 'Brush Script MT', cursive`,
    serif: (fs) => `italic 500 ${fs}px 'Playfair Display', Georgia, serif`,
    num: (fs) => `500 ${fs}px 'Playfair Display', Georgia, serif`,
  };
  function textPoints(text, box, kind = 'serif') {
    const lines = String(text).split('\n');
    const off = document.createElement('canvas');
    off.width = Math.ceil(W); off.height = Math.ceil(H);
    const o = off.getContext('2d', { willReadFrequently: true });
    const mkFont = FONTS[kind] || FONTS.serif;
    let fs = Math.min(box.maxH / (lines.length * 1.15), 260);
    o.font = mkFont(fs);
    const mw = Math.max(...lines.map((l) => o.measureText(l).width));
    if (mw > box.maxW) fs *= box.maxW / mw;
    o.font = mkFont(fs);
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    const lh = fs * 1.15, top = box.cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => o.fillText(l, box.cx, top + i * lh));
    const ow = off.width, oh = off.height;
    const d = o.getImageData(0, 0, ow, oh).data;
    let filled = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) filled++;
    const s = Math.max(2, Math.ceil(Math.sqrt(filled / (N * 0.92))));
    const pts = [];
    for (let y = 0; y < oh; y += s) for (let x = 0; x < ow; x += s)
      if (d[(y * ow + x) * 4 + 3] > 128) pts.push({ x, y, c: null });
    return { pts, s, photo: false, lines, fs, lh, top, cx: box.cx, font: mkFont(fs) };
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
        const fresh = p.tx === null;
        p.tx = t.x; p.ty = t.y;
        // Oltin-shampan rangidagi nuqtalar
        p.col = t.c || `hsl(${36 + Math.random() * 16},${70 + Math.random() * 30}%,${68 + Math.random() * 22}%)`;
        p.sz = r.photo ? r.s * 1.02 : Math.max(1.4, r.s * 0.55);
        if (fresh) p.d = Math.random() * 40; // har biri biroz kechikib, oqib keladi
      } else { p.tx = null; p.col = null; }
    });
  }

  // Yozuvni sekin eritib yuborish (portlatmasdan)
  function dissolve() {
    mode = 'text';
    for (const p of parts) {
      if (p.tx !== null) {
        p.vx += (Math.random() - 0.5) * 1.6;
        p.vy += -Math.random() * 1.6 - 0.2;
      }
      p.tx = null; p.col = null;
    }
  }
  const explode = dissolve;

  // ---------- Tiniq oltin yozuv (nuqtalar yig'ilgandan keyin paydo bo'ladi) ----------
  const titleEl = $('title');
  let txtA = 1, txtTarget = 1;
  function placeTitle(r) {
    titleEl.innerHTML = '';
    r.lines.forEach((l, i) => {
      const sp = document.createElement('span');
      sp.textContent = l;
      sp.style.font = r.font;
      sp.style.left = r.cx + 'px';
      sp.style.top = (r.top + i * r.lh) + 'px';
      titleEl.appendChild(sp);
    });
  }
  function titleOn() { titleEl.classList.remove('out'); titleEl.classList.add('on'); txtTarget = 0.12; }
  function titleOff() { titleEl.classList.add('out'); titleEl.classList.remove('on'); txtTarget = 1; }

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
  // ---------- Uchar yulduzlar ----------
  const meteors = [];
  let meteorSky = false;
  function meteor(x, y) {
    const sp = 9 + Math.random() * 5, a = Math.PI * (0.72 + Math.random() * 0.08);
    if (x === undefined) { x = W * (0.3 + Math.random() * 0.8); y = -20 + Math.random() * H * 0.3; }
    meteors.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, len: 90 + Math.random() * 70 });
  }
  function drawMeteors() {
    if (meteorSky && Math.random() < 0.006) meteor();
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx; m.y += m.vy; m.life -= 0.012;
      if (m.life <= 0 || m.y > H + 50 || m.x < -200) { meteors.splice(i, 1); continue; }
      const sp = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,248,225,${m.life.toFixed(2)})`); g.addColorStop(0.3, `rgba(246,214,140,${(m.life * 0.5).toFixed(2)})`); g.addColorStop(1, 'rgba(246,214,140,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${m.life.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, 2, 0, 6.29); ctx.fill();
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
      daisy: Math.random() < 0.3,
    });
  }
  // Atirgul gulbarglari
  const PCOLS = ['#b3001b', '#c8102e', '#e0234e', '#f25c7a', '#ff9ab3', '#ffd1dc'];
  function addPetals(n, at) {
    for (let i = 0; i < n; i++) {
      const p = {
        x: Math.random() * W, y: -20 - Math.random() * H * 0.5,
        vx: (Math.random() - 0.5) * 1.2, vy: 0.8 + Math.random() * 0.9,
        w: 6 + Math.random() * 6, h: 0, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.06,
        sw: Math.random() * 6.28, c: PCOLS[(Math.random() * PCOLS.length) | 0],
        petal: Math.random() > 0.15, daisy: false,
      };
      p.daisy = !p.petal; p.fall = p.vy;
      if (at) {
        const a = Math.random() * 6.28, f = 2 + Math.random() * 6;
        p.x = at.x; p.y = at.y; p.vx = Math.cos(a) * f; p.vy = Math.sin(a) * f - 2;
      }
      confetti.push(p);
    }
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
      if (c.fall !== undefined) { c.vy += (c.fall - c.vy) * 0.04; c.vx *= 0.97; }
      c.sw += c.petal ? 0.03 : 0.05; c.x += c.vx + Math.sin(c.sw) * (c.petal ? 1.1 : 0.8); c.y += c.vy; c.r += c.vr;
      if (c.y > H + 30) { confetti.splice(i, 1); continue; }
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
      if (c.petal) {
        const w = c.w, h = c.w * 1.25;
        ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(c.sw * 1.6)));
        ctx.fillStyle = c.c;
        ctx.beginPath(); ctx.moveTo(0, -h);
        ctx.bezierCurveTo(w, -h * 0.7, w * 0.85, h * 0.9, 0, h);
        ctx.bezierCurveTo(-w * 0.85, h * 0.9, -w, -h * 0.7, 0, -h); ctx.fill();
        ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-w * 0.25, -h * 0.25, w * 0.25, h * 0.4, 0.3, 0, 6.29); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (c.daisy) {
        // Romashka gulchasi 🌼
        const r = c.w * 0.9;
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 8; k++) {
          ctx.beginPath(); ctx.ellipse(Math.cos(k * 0.785) * r * 0.6, Math.sin(k * 0.785) * r * 0.6, r * 0.55, r * 0.24, k * 0.785, 0, 6.29); ctx.fill();
        }
        ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, 6.29); ctx.fill();
      } else {
        ctx.scale(1, Math.cos(c.sw * 2)); ctx.fillStyle = c.c;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      }
      ctx.restore();
    }
  }

  // ---------- Musiqa (fayl bo'lmasa, brauzerning o'zida "music box" chalinadi) ----------
  let actx = null, master = null, musicBus = null, musicOn = true, musicTimer = null;
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
      musicBus = actx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
      const delay = actx.createDelay(), fb = actx.createGain(), wet = actx.createGain();
      delay.delayTime.value = 0.32; fb.gain.value = 0.33; wet.gain.value = 0.35;
      master.connect(actx.destination); master.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(actx.destination);
    } catch (e) { actx = null; }
  }
  function bell(t, freq, dur, vol, dest) {
    [[1, 1], [2, 0.35], [3.01, 0.12]].forEach(([m, v]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  // Har bir kuy o'z "shinasi"ga chalinadi — kuy almashganda eskisi silliq so'nadi, ustma-ust tushmaydi
  let songMode = 'hb', songBus = null, nextT = 0;
  function startSong(mode) {
    if (!actx || audio) return;
    if (mode) songMode = mode;
    clearTimeout(musicTimer);
    if (songBus) { const old = songBus; old.gain.setTargetAtTime(0, actx.currentTime, 0.5); setTimeout(() => old.disconnect(), 4000); }
    songBus = actx.createGain(); songBus.connect(musicBus);
    nextT = 0;
    loopSong();
  }
  function playSong() { startSong(); }
  function loopSong() {
    if (!actx || !musicOn || audio) return;
    if (songMode === 'end') playEnd(); else playHB();
  }
  function playHB() {
    const beat = 0.5; let t = actx.currentTime + 0.1, tb = t;
    for (const [n, d] of SONG) { bell(t, NOTE(n), Math.max(1.2, d * beat * 2), 0.22, songBus); t += d * beat; }
    for (const [n, d] of BASS) { bell(tb, NOTE(n), d * beat * 1.5, 0.1, songBus); tb += d * beat; }
    musicTimer = setTimeout(loopSong, (t - actx.currentTime + 2.5) * 1000);
  }
  // Yakun kuyi (o'zimiz tuzgan): C – Am – F – G, yumshoq akkordlar + music box arpedjio + sokin ohang
  const END_CHORDS = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
  const END_MELODY = [
    [[76, 2], [74, 1], [72, 1]], [[72, 3], [69, 1]], [[69, 2], [72, 1], [77, 1]], [[76, 3], [74, 1]],
    [[76, 2], [79, 1], [76, 1]], [[74, 2], [72, 2]], [[72, 1], [74, 1], [76, 2]], [[74, 3], [0, 1]],
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 1];
  function pad(t, notes, dur, vol) {
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.connect(songBus);
    notes.forEach((n) => [-6, 6].forEach((dt) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = NOTE(n - 12); o.detune.value = dt;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 1.2);
      g.gain.setValueAtTime(vol, t + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
      o.connect(g); g.connect(f); o.start(t); o.stop(t + dur + 1.3);
    }));
  }
  function playEnd() {
    const beat = 0.62, bar = beat * 4;
    let t = Math.max(actx.currentTime + 0.15, nextT);
    for (let b = 0; b < 8; b++) {
      const ch = END_CHORDS[b % 4], t0 = t + b * bar;
      pad(t0, ch.slice(0, 3), bar, 0.032);
      bell(t0, NOTE(ch[0] - 24), bar * 1.2, 0.1, songBus);
      ARP.forEach((k, i) => bell(t0 + i * beat / 2, NOTE(ch[k] + 12), 1.6, 0.065, songBus));
      let mt = t0;
      END_MELODY[b].forEach(([n, d]) => { if (n) bell(mt, NOTE(n), Math.max(1.6, d * beat * 1.6), 0.2, songBus); mt += d * beat; });
    }
    nextT = t + 8 * bar;
    musicTimer = setTimeout(loopSong, (nextT - actx.currentTime - 0.6) * 1000);
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
    if (type === 'pop') {
      const len = 0.12, buf = actx.createBuffer(1, actx.sampleRate * len, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = actx.createBufferSource(), g = actx.createGain(); g.gain.value = 0.6;
      src.buffer = buf; src.connect(g); g.connect(master); src.start(t);
      bell(t + 0.05, NOTE(84 + ((Math.random() * 8) | 0)), 0.8, 0.1);
    }
    if (type === 'magic') [76, 79, 83, 88, 91].forEach((n, i) => bell(t + i * 0.08, NOTE(n), 1.4, 0.1));
  }
  // Musiqani vaqtincha pasaytirish (sham puflash, ovozli xabar paytida)
  function duck(v) {
    if (musicBus) musicBus.gain.setTargetAtTime(v, actx.currentTime, 0.3);
    if (audio) audio.volume = Math.max(0, Math.min(1, v));
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
    txtA += (txtTarget - txtA) * 0.04;
    for (const p of parts) {
      let has = p.tx !== null;
      if (has && p.d > 0) { p.d--; }
      const go = has && !(p.d > 0);
      const tx = go ? p.tx : p.hx, ty = go ? p.ty : p.hy, k = go ? 0.012 : 0.0015;
      p.vx += (tx - p.x) * k; p.vy += (ty - p.y) * k;
      if (repel) {
        const dx = p.x - ptr.x, dy = p.y - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < R2) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.5; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      }
      p.vx *= 0.85; p.vy *= 0.85; p.x += p.vx; p.y += p.vy;
      if (has) {
        ctx.globalAlpha = mode === 'photo' ? 1 : txtA;
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
        ctx.globalAlpha = 1;
      } else {
        const a = 0.22 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.0015 + p.tw));
        ctx.fillStyle = `rgba(210,215,255,${a.toFixed(2)})`;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    drawFireworks();
    drawMeteors();
    drawFx();
    if ((finalMode || petalRain) && confetti.length < (meteorSky ? 22 : 55) && Math.random() < (meteorSky ? 0.06 : 0.16)) addPetals(1);
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
    ['card', 'tapHint', 'gallery', 'lb', 'cakeScene', 'balloonScene', 'boxScene', 'bouquetScene', 'letter'].forEach((id) => $(id).classList.remove('on'));
    petalRain = false;
    $('card').classList.remove('writing'); $('card').style.transition = ''; $('card').style.transform = '';
    $('shards').innerHTML = '';
    sceneCleanup.forEach((f) => f()); sceneCleanup = [];
    stopVoice();
    $('sign').classList.remove('on');
    hero.classList.remove('on');
    titleOff();
    galleryOn = false;
    galleryDone = null;
  }

  async function run() {
    const id = ++runId;
    const S = (ms) => sleep(ms, id);
    resetUI();
    try {
      // Yulduzlar sekin yig'ilib, tiniq oltin yozuvga aylanadi, keyin eriydi
      const say = async (text, box, kind, hold, onShow) => {
        txtTarget = 1;
        show(() => { const r = textPoints(text, box(), kind); assign(r); placeTitle(r); });
        await S(1700);
        titleOn(); if (onShow) onShow();
        await S(hold);
        titleOff(); current = null; dissolve();
        await S(1300);
      };
      await S(700);
      await say(C.ism, () => ({ cx: W / 2, cy: H * 0.46, maxW: W * 0.9, maxH: H * 0.3 }), 'script', 2600, () => sfx('magic'));

      for (const w of (C.sozlar || [])) await say(w, mainBox, 'serif', 1500);

      await say('Bugun —\nsizning kuningiz', () => ({ cx: W / 2, cy: H / 2, maxW: W * 0.86, maxH: H * 0.3 }), 'serif', 2200);

      if (C.yosh) await say(String(C.yosh), () => ({ cx: W / 2, cy: H * 0.46, maxW: W * 0.6, maxH: H * 0.36 }), 'num', 2200, () => sfx('magic'));

      // Asosiy surat: zarrachalardan yig'iladi
      if (mainImg) {
        hero.src = mainImg.src;
        show(() => {
          const r = photoPoints(mainImg, { cx: W / 2, cy: H / 2, maxW: W * 0.8, maxH: H * 0.66 });
          assign(r);
          Object.assign(hero.style, { left: r.rect.x + 'px', top: r.rect.y + 'px', width: r.rect.w + 'px', height: r.rect.h + 'px' });
        });
        await S(2800);
        hero.classList.add('on'); sfx('magic'); await S(2200);
        // Rasm bo'laklarga bo'linadi — boshqotirma
        current = null; dissolve();
        await puzzleScene(mainImg.src); await S(0);
        await S(900);
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

      // Tort va shamlar
      current = null;
      await cakeScene(); await S(0);
      $('cakeScene').classList.remove('on');

      // Tabrik + salyut
      for (let i = 0; i < 6; i++) setTimeout(() => id === runId && randomLaunch(), 1900 + i * 380);
      setTimeout(() => { if (id === runId) { addConfetti(90); buzz([30, 60, 30]); } }, 1800);
      await say("Tug'ilgan kuningiz\nmuborak!", () => ({ cx: W / 2, cy: H * 0.45, maxW: W * 0.9, maxH: H * 0.3 }), 'serif', 3000, () => sfx('magic'));

      // Sharlar
      current = null;
      if ((C.tilaklar || []).length) { await balloonScene(); await S(0); $('balloonScene').classList.remove('on'); await S(700); }

      // Sirli qutilar
      if ((C.sirliQutilar || []).length) { await boxScene(); await S(0); $('boxScene').classList.remove('on'); await S(700); }

      // Atirgul buketi
      await bouquetScene(); await S(0);
      $('bouquetScene').classList.remove('on'); await S(900);

      // Yakun: muhrli maktub
      finalMode = true;
      txtTarget = 1;
      show(() => { const r = textPoints(C.ism, { cx: W / 2, cy: H * 0.17, maxW: W * 0.85, maxH: H * 0.2 }, 'script'); assign(r); placeTitle(r); });
      await S(1700); titleOn();
      await letterScene(); await S(300);
      fwTimer = setInterval(randomLaunch, 1800);
      $('tapHint').classList.add('on');
      $('voiceBtn').hidden = !C.ovozliTabrik;
      typeText(C.tabrik, id);
    } catch (e) {
      if (e !== 'stop') console.error('Ketma-ketlikda xatolik:', e);
    }
  }

  // ================= Sahnalar =================
  let sceneCleanup = [];

  // ---------- 1. Tort va shamlarni puflash ----------
  function cakeScene() {
    return new Promise((done) => {
      const box = $('candles'); box.innerHTML = '';
      const nums = C.yosh ? [...String(C.yosh)] : ['', '', ''];
      nums.forEach((n) => {
        const c = document.createElement('div');
        c.className = 'candle' + (n ? ' num' : ' plain');
        c.innerHTML = '<div class="flame"></div>' + (n ? `<span>${n}</span>` : '<i></i>');
        box.appendChild(c);
      });
      const candles = [...box.children];
      const hint = $('cakeHint'), lvl = $('micLvl');
      hint.textContent = "Tilak tilang va puflab o'chiring 🌬️";
      $('cakeScene').classList.add('on');
      duck(0.25);
      let finished = false, stream = null, raf = 0;
      const stopMic = () => { cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
      sceneCleanup.push(() => { finished = true; stopMic(); duck(1); });

      const blowOut = (c) => {
        if (finished || c.classList.contains('out')) return;
        c.classList.add('out'); sfx('tick'); buzz(20);
        if (candles.every((x) => x.classList.contains('out'))) {
          finished = true; stopMic(); duck(1);
          hint.textContent = 'Tilagingiz albatta ushalsin! ✨';
          const r = box.getBoundingClientRect();
          setTimeout(() => { shock(r.left + r.width / 2, r.top + r.height / 2, 40); sfx('magic'); addConfetti(120); }, 300);
          setTimeout(done, 1800);
        }
      };
      candles.forEach((c) => c.addEventListener('pointerdown', (e) => { e.stopPropagation(); blowOut(c); }));
      $('cakeScene').addEventListener('pointerdown', (e) => {
        // Shamga yaqin bosilsa ham o'chadi (telefonda nishonga tegish oson bo'lsin)
        const lit = candles.filter((c) => !c.classList.contains('out'));
        let best = null, bd = 1e9;
        lit.forEach((c) => { const r = c.getBoundingClientRect(); const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); if (d < bd) { bd = d; best = c; } });
        if (best && bd < 90) blowOut(best);
      });

      // Mikrofon orqali puflashni aniqlash
      if (actx && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } })
          .then((st) => {
            if (finished) { st.getTracks().forEach((t) => t.stop()); return; }
            stream = st;
            const an = actx.createAnalyser(); an.fftSize = 1024;
            actx.createMediaStreamSource(st).connect(an);
            const buf = new Float32Array(an.fftSize);
            let cnt = 0;
            hint.textContent = "Tilak tilang va telefonga puflab o'chiring 🌬️";
            $('micMeter').classList.add('on');
            const loop = () => {
              if (finished) return;
              an.getFloatTimeDomainData(buf);
              let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
              const rms = Math.sqrt(sum / buf.length);
              lvl.style.width = Math.min(100, rms * 400) + '%';
              cnt = rms > 0.14 ? cnt + 1 : Math.max(0, cnt - 1);
              if (cnt > 9) {
                const lit = candles.filter((c) => !c.classList.contains('out'));
                if (lit.length) blowOut(lit[(Math.random() * lit.length) | 0]);
                cnt = 4;
              }
              candles.forEach((c) => c.style.setProperty('--wind', Math.min(1, rms * 6).toFixed(2)));
              raf = requestAnimationFrame(loop);
            };
            loop();
          })
          .catch(() => { hint.textContent = "Tilak tilang va shamlarni bosib o'chiring 🕯️"; });
      } else {
        hint.textContent = "Tilak tilang va shamlarni bosib o'chiring 🕯️";
      }
    });
  }

  // ---------- 3. Sharlarni yorib tilak yig'ish ----------
  const BCOLS = ['#ff4fa3', '#ffb347', '#7ad7ff', '#b892ff', '#5be3a1', '#ff6b6b', '#ffd36e'];
  function balloonScene() {
    return new Promise((done) => {
      const sc = $('balloonScene'), field = $('bField'), got = $('bGot');
      field.innerHTML = ''; got.innerHTML = '';
      const wishes = [...C.tilaklar];
      const queue = shuffle(wishes.map((_, i) => i));
      let popped = 0, alive = true, raf = 0, last = 0, spawnT = 0;
      const live = [];
      const cnt = () => { $('bCount').textContent = `${popped} / ${wishes.length}`; };
      cnt();
      $('bNext').classList.remove('ready');
      sc.classList.add('on');
      const finish = () => { if (!alive) return; alive = false; cancelAnimationFrame(raf); field.innerHTML = ''; done(); };
      $('bNext').onclick = finish;
      sceneCleanup.push(() => { alive = false; cancelAnimationFrame(raf); field.innerHTML = ''; });

      function spawn() {
        if (!queue.length) return;
        const wi = queue.shift();
        const el = document.createElement('div');
        el.className = 'balloon';
        const col = BCOLS[(Math.random() * BCOLS.length) | 0];
        el.style.setProperty('--b', col);
        const b = { el, wi, x: 40 + Math.random() * (W - 80), y: H + 60, sp: 0.9 + Math.random() * 0.7, ph: Math.random() * 6.28, col };
        el.addEventListener('pointerdown', (e) => { e.stopPropagation(); pop(b); });
        field.appendChild(el); live.push(b);
      }
      function pop(b) {
        const i = live.indexOf(b); if (i < 0) return;
        live.splice(i, 1); b.el.remove();
        const cx = b.cx || b.x, cy = b.y;
        burst(cx, cy, Math.random() * 360); sfx('pop'); buzz(15);
        const w = document.createElement('div');
        w.className = 'wish'; w.textContent = wishes[b.wi];
        w.style.left = Math.max(90, Math.min(W - 90, cx)) + 'px'; w.style.top = Math.max(80, cy) + 'px';
        field.appendChild(w); setTimeout(() => w.remove(), 1600);
        const chip = document.createElement('span'); chip.textContent = wishes[b.wi]; chip.style.borderColor = b.col; got.appendChild(chip);
        popped++; cnt();
        if (popped === wishes.length) {
          $('bNext').classList.add('ready'); $('bNext').textContent = 'Hammasi sizniki! Davom etish →';
          shock(W / 2, H / 2, 140); sfx('magic'); addConfetti(100);
        }
      }
      function loop(t) {
        if (!alive) return;
        const dt = last ? Math.min(50, t - last) / 16.7 : 1; last = t;
        spawnT -= dt;
        if (spawnT <= 0 && live.length < 4) { spawn(); spawnT = 45 + Math.random() * 30; }
        for (let i = live.length - 1; i >= 0; i--) {
          const b = live[i];
          b.y -= b.sp * dt * 1.6; b.ph += 0.03 * dt;
          const x = b.x + Math.sin(b.ph) * 18;
          b.el.style.transform = `translate(${x - 36}px, ${b.y - 45}px) rotate(${Math.sin(b.ph) * 6}deg)`;
          b.cx = x;
          if (b.y < -120) { live.splice(i, 1); b.el.remove(); queue.push(b.wi); }
        }
        raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
    });
  }

  // ---------- 4. Sirli qutilar ----------
  function boxScene() {
    return new Promise((done) => {
      const sc = $('boxScene'), wrap = $('boxes');
      wrap.innerHTML = '';
      const msgs = shuffle([...C.sirliQutilar]).slice(0, 3);
      $('boxNext').classList.remove('ready');
      $('boxTitle').textContent = 'Bittasini tanlang 🎁';
      let chosen = false;
      msgs.forEach((m, i) => {
        const el = document.createElement('div');
        el.className = 'mbox';
        el.innerHTML = `<div class="mb-in"><div class="mb-f"><b>🎁</b><span>?</span></div><div class="mb-b"></div></div>`;
        el.querySelector('.mb-b').textContent = m;
        el.style.animationDelay = i * 0.15 + 's';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (chosen) return; chosen = true;
          el.classList.add('open', 'chosen'); sfx('magic'); buzz([20, 40, 20]);
          const r = el.getBoundingClientRect();
          shock(r.left + r.width / 2, r.top + r.height / 2, 280); burst(r.left + r.width / 2, r.top + r.height / 3, 300);
          setTimeout(() => {
            $('boxTitle').textContent = 'Qolganlarida nima bor edi? 👀';
            [...wrap.children].forEach((b) => b.classList.add('open'));
            $('boxNext').classList.add('ready');
          }, 2200);
        });
        wrap.appendChild(el);
      });
      $('boxNext').onclick = () => done();
      sc.classList.add('on');
    });
  }

  // ---------- Boshqotirma (puzzle) ----------
  function puzzleScene(src) {
    return new Promise((done) => {
      const COLS = 3, ROWS = 4, n = COLS * ROWS;
      const L = parseFloat(hero.style.left), T = parseFloat(hero.style.top);
      const PW = parseFloat(hero.style.width), PH = parseFloat(hero.style.height);
      const cw = PW / COLS, ch = PH / ROWS, gap = 3;
      const box = $('puzzle'), hint = $('pzHint'), skip = $('pzSkip');
      box.innerHTML = ''; box.className = 'puzzle on'; box.style.backgroundImage = 'none';
      Object.assign(box.style, { left: L + 'px', top: T + 'px', width: PW + 'px', height: PH + 'px' });
      hint.textContent = "Bo'laklarni almashtirib, rasmni yig'ing 🧩";
      hint.classList.add('on');

      // slot[i] = qaysi bo'lak i-joyda turibdi
      let slot = [...Array(n).keys()];
      const tiles = slot.map((pi) => {
        const el = document.createElement('div');
        el.className = 'pz';
        const c = pi % COLS, r = (pi / COLS) | 0;
        Object.assign(el.style, {
          width: cw + 'px', height: ch + 'px',
          backgroundImage: `url("${src}")`, backgroundSize: `${PW}px ${PH}px`,
          backgroundPosition: `${-c * cw}px ${-r * ch}px`,
        });
        el.dataset.p = pi;
        box.appendChild(el);
        return el;
      });
      const place = (instant) => {
        slot.forEach((pi, si) => {
          const el = tiles[pi], c = si % COLS, r = (si / COLS) | 0;
          if (instant) el.style.transition = 'none';
          el.style.transform = `translate(${c * cw}px, ${r * ch}px)`;
          el.classList.toggle('ok', pi === si);
          if (instant) { void el.offsetWidth; el.style.transition = ''; }
        });
      };
      place(true);
      // Rasm o'rniga bir zumda bo'laklar qo'yiladi
      hero.classList.add('instant'); hero.classList.remove('on');
      requestAnimationFrame(() => hero.classList.remove('instant'));

      let finished = false, sel = null, skipT = 0;
      const cleanup = () => {
        finished = true; clearTimeout(skipT);
        box.className = 'puzzle'; hint.classList.remove('on'); skip.classList.remove('on');
        setTimeout(() => { if (!box.classList.contains('on')) box.innerHTML = ''; }, 1200);
      };
      sceneCleanup.push(cleanup);

      const solved = () => slot.every((pi, si) => pi === si);
      const win = () => {
        finished = true; clearTimeout(skipT);
        skip.classList.remove('on');
        if (sel) { sel.classList.remove('sel'); sel = null; }
        box.style.backgroundImage = `url("${src}")`;
        box.classList.add('solved');
        hint.textContent = 'Barakalla! ✨';
        sfx('magic'); buzz([30, 50, 30]);
        const cx = L + PW / 2, cy = T + PH / 2;
        setTimeout(() => { burst(cx, T + PH * 0.2, 42); burst(cx - PW * 0.3, cy, 35); burst(cx + PW * 0.3, cy, 50); }, 500);
        setTimeout(() => { box.classList.add('fade'); hint.classList.remove('on'); }, 3200);
        setTimeout(() => { cleanup(); done(); }, 4200);
      };
      const swap = (a, b) => {
        const i = slot.indexOf(a), j = slot.indexOf(b);
        [slot[i], slot[j]] = [slot[j], slot[i]];
        place(false); sfx('tick'); buzz(12);
        if (solved()) setTimeout(win, 450);
      };

      // Aralashtirish: hech bir bo'lak o'z joyida qolmasin
      setTimeout(() => {
        if (finished) return;
        do { shuffle(slot); } while (slot.some((pi, si) => pi === si));
        box.classList.add('split');
        place(false);
      }, 700);
      skipT = setTimeout(() => skip.classList.add('on'), 25000);
      skip.onclick = (e) => { e.stopPropagation(); if (finished) return; slot = [...Array(n).keys()]; place(false); setTimeout(win, 500); };

      // Bosish yoki sudrab olib borish
      let drag = null;
      box.onpointerdown = (e) => {
        if (finished) return;
        const el = e.target.closest('.pz'); if (!el) return;
        e.stopPropagation(); e.preventDefault();
        drag = { el, x: e.clientX, y: e.clientY, moved: false, base: el.style.transform };
        el.setPointerCapture(e.pointerId);
      };
      box.onpointermove = (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 8) return;
        drag.moved = true;
        drag.el.classList.add('drag');
        const si = slot.indexOf(+drag.el.dataset.p), c = si % COLS, r = (si / COLS) | 0;
        drag.el.style.transform = `translate(${c * cw + dx / 1.04}px, ${r * ch + dy / 1.04}px) scale(1.06)`;
      };
      box.onpointerup = (e) => {
        if (!drag) return;
        const d = drag; drag = null;
        d.el.classList.remove('drag');
        if (d.moved) {
          // Konteyner 1.04 marta kattalashtirilgan — markazga nisbatan qayta hisoblaymiz
          const ux = L + PW / 2 + (e.clientX - (L + PW / 2)) / 1.04, uy = T + PH / 2 + (e.clientY - (T + PH / 2)) / 1.04;
          const c = Math.floor((ux - L) / cw), r = Math.floor((uy - T) / ch);
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
            const target = slot[r * COLS + c];
            if (target !== +d.el.dataset.p) { if (sel) { sel.classList.remove('sel'); sel = null; } return swap(+d.el.dataset.p, target); }
          }
          return place(false);
        }
        // Oddiy bosish: birinchisini tanlash, ikkinchisi bilan almashtirish
        if (!sel) { sel = d.el; sel.classList.add('sel'); return; }
        if (sel === d.el) { sel.classList.remove('sel'); sel = null; return; }
        const a = +sel.dataset.p; sel.classList.remove('sel'); sel = null;
        swap(a, +d.el.dataset.p);
      };
    });
  }

  // ---------- Atirgul buketi ----------
  const ROSE = {
    red: ['#4a000e', '#a8102a', '#e8304f'],
    pink: ['#8c2350', '#e5668e', '#ffc3d3'],
    cream: ['#a77c55', '#efd6b8', '#fff8ee'],
  };
  function petalPath(R) {
    return `M0,0 C${-0.8 * R},${-0.18 * R} ${-0.82 * R},${-0.98 * R} 0,${-R} C${0.82 * R},${-0.98 * R} ${0.8 * R},${-0.18 * R} 0,0Z`;
  }
  function roseSVG(r, col, delay) {
    const layers = [[6, 1, 0], [5, 0.74, 22], [4, 0.52, 48], [3, 0.32, 12]];
    let g = `<g class="rose" style="animation-delay:${delay}s">`;
    layers.forEach(([n, sc, off], li) => {
      g += `<g class="rl" style="animation-delay:${(delay + 0.12 + li * 0.12).toFixed(2)}s">`;
      for (let k = 0; k < n; k++) g += `<path d="${petalPath(r * sc)}" transform="rotate(${off + (k * 360) / n})" fill="url(#rg-${col})" stroke="${ROSE[col][0]}" stroke-opacity=".35" stroke-width=".7"/>`;
      g += '</g>';
    });
    g += `<circle r="${(r * 0.12).toFixed(1)}" fill="${ROSE[col][0]}" opacity=".85"/></g>`;
    return g;
  }
  function buildBouquet() {
    const roses = [
      [150, 92, 30, 'red'], [103, 112, 27, 'pink'], [197, 112, 27, 'red'],
      [76, 156, 24, 'red'], [224, 156, 24, 'pink'], [126, 148, 29, 'red'], [174, 148, 29, 'cream'],
      [150, 186, 26, 'red'], [102, 192, 23, 'cream'], [198, 192, 23, 'red'],
    ];
    let defs = '<defs>';
    for (const [k, c] of Object.entries(ROSE))
      defs += `<linearGradient id="rg-${k}" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient>`;
    defs += `<linearGradient id="wb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e6dc"/><stop offset="1" stop-color="#dcbcae"/></linearGradient>
      <linearGradient id="wf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1ec"/><stop offset=".5" stop-color="#f3cfc6"/><stop offset="1" stop-color="#d9a79c"/></linearGradient>
      <linearGradient id="lf" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="#1f4d2a"/><stop offset="1" stop-color="#6aa65a"/></linearGradient>
      <linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c9"/><stop offset=".5" stop-color="#e2b25e"/><stop offset="1" stop-color="#a8722c"/></linearGradient></defs>`;
    let out = defs;
    out += `<path class="bq-in" style="animation-delay:.1s" d="M38,150 Q150,118 262,150 L158,402 L142,402 Z" fill="url(#wb)"/>`;
    // Barglar
    const leaves = [[58, 128, -55], [242, 128, 55], [48, 190, -80], [252, 190, 80], [150, 52, 0], [88, 78, -25], [212, 78, 25]];
    leaves.forEach(([x, y, a], i) => {
      out += `<g transform="translate(${x},${y}) rotate(${a})"><g class="bq-pop" style="animation-delay:${(0.5 + i * 0.08).toFixed(2)}s">
        <path d="M0,10 C12,-2 12,-26 0,-42 C-12,-26 -12,-2 0,10Z" fill="url(#lf)"/><path d="M0,8 L0,-38" stroke="#bfe3a8" stroke-opacity=".5" stroke-width="1"/></g></g>`;
    });
    // Poyalar
    roses.forEach(([x, y], i) => {
      const bx = 150 + (x - 150) * 0.12;
      out += `<path class="stem" pathLength="1" style="animation-delay:${(0.35 + i * 0.05).toFixed(2)}s" d="M${bx},335 Q${(x + bx) / 2},${(y + 335) / 2 + 20} ${x},${y}" stroke="#3b7a40" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    });
    // Mayda oq gullar
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI, rr = 95 + Math.random() * 30;
      const x = 150 + Math.cos(a) * rr * 1.05, y = 160 - Math.sin(a) * rr * 0.95;
      out += `<circle class="bb" style="animation-delay:${(2 + Math.random() * 1.2).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.8 + Math.random() * 2).toFixed(1)}" fill="#fff"/>`;
    }
    // Atirgullar (pastdagilari ustda)
    roses.slice().sort((a, b) => a[1] - b[1]).forEach(([x, y, r, c]) => {
      const i = roses.findIndex((q) => q[0] === x && q[1] === y);
      out += `<g transform="translate(${x},${y})">${roseSVG(r, c, +(1.1 + i * 0.2).toFixed(2))}</g>`;
    });
    // Old o'ram va lenta
    out += `<path class="bq-in" style="animation-delay:.2s" d="M28,208 C95,246 205,246 272,208 L162,404 L138,404 Z" fill="url(#wf)"/>
      <path class="bq-in" style="animation-delay:.2s" d="M28,208 C95,246 205,246 272,208" stroke="url(#gd)" stroke-width="2.5" fill="none"/>
      <path class="bq-in" style="animation-delay:.2s" d="M150,243 L150,402 M110,240 L146,402 M190,240 L154,402" stroke="#000" stroke-opacity=".06" stroke-width="1.5"/>
      <g transform="translate(150,320)"><g class="bq-pop" style="animation-delay:3.1s">
        <path d="M-2,4 L-26,52 L-16,50 L-10,58 L4,8Z M2,4 L26,52 L16,50 L10,58 L-4,8Z" fill="url(#gd)"/>
        <ellipse cx="-22" cy="-6" rx="24" ry="12" transform="rotate(-24 -22 -6)" fill="none" stroke="url(#gd)" stroke-width="8"/>
        <ellipse cx="22" cy="-6" rx="24" ry="12" transform="rotate(24 22 -6)" fill="none" stroke="url(#gd)" stroke-width="8"/>
        <circle r="8" fill="url(#gd)"/></g></g>`;
    return { svg: out, count: roses.length };
  }
  function bouquetScene() {
    return new Promise((done) => {
      const sc = $('bouquetScene'), holder = $('bouquet');
      const b = buildBouquet();
      holder.innerHTML = `<svg viewBox="0 0 300 410" aria-label="Atirgul buketi">${b.svg}</svg>`;
      $('bqTitle').classList.remove('on'); $('bqNext').classList.remove('ready');
      sc.classList.add('on');
      const ts = [];
      const later = (fn, ms) => ts.push(setTimeout(fn, ms));
      sceneCleanup.push(() => { ts.forEach(clearTimeout); petalRain = false; });
      // Har bir gul ochilganda yengil nota
      const notes = [72, 74, 76, 79, 81, 84, 81, 79, 76, 84];
      for (let i = 0; i < b.count; i++) later(() => actx && musicOn && bell(actx.currentTime, NOTE(notes[i] + 12), 1.4, 0.07), (1.15 + i * 0.2) * 1000);
      later(() => { $('bqTitle').classList.add('on'); sfx('magic'); petalRain = true; addPetals(25); }, 3600);
      later(() => $('bqNext').classList.add('ready'), 5600);
      holder.onclick = (e) => {
        e.stopPropagation();
        const r = holder.getBoundingClientRect();
        addPetals(26, { x: r.left + r.width / 2, y: r.top + r.height * 0.35 });
        sfx('magic'); buzz(20);
        holder.classList.remove('sway'); void holder.offsetWidth; holder.classList.add('sway');
      };
      $('bqNext').onclick = () => { ts.forEach(clearTimeout); petalRain = false; done(); };
    });
  }

  // ---------- Muhrli maktub ----------
  function letterScene() {
    return new Promise((done) => {
      const L = $('letter'), env = L.querySelector('.env'), seal = $('seal');
      const paper = L.querySelector('.env-paper'), card = $('card');
      env.classList.remove('open', 'rise', 'gone'); seal.classList.remove('broken');
      seal.textContent = (C.ism || 'S').trim()[0] || 'S';
      L.classList.add('on');
      let opened = false;
      seal.onclick = (e) => {
        e.stopPropagation();
        if (opened) return; opened = true;
        seal.classList.add('broken'); sfx('tick'); buzz(25);
        setTimeout(() => { env.classList.add('open'); sfx('magic'); }, 350);
        setTimeout(() => env.classList.add('rise'), 1100);
        setTimeout(() => {
          // 1) Qog'oz o'rnida haqiqiy maktub paydo bo'ladi
          const from = paper.getBoundingClientRect();
          // 2) Konvert parchalanib sochiladi
          shatter(env);
          env.classList.add('gone');
          $('msg').textContent = ''; $('sign').classList.remove('on');
          card.classList.add('writing');
          card.style.transition = 'none'; card.style.transform = 'none';
          card.classList.add('on');
          const to = card.getBoundingClientRect();
          card.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
          void card.offsetWidth;
          card.style.transition = 'transform 1.3s cubic-bezier(.3,.9,.3,1), box-shadow 1.3s';
          card.style.transform = 'none';
          sfx('pop'); buzz([20, 40, 20]);
          setTimeout(() => { L.classList.remove('on'); done(); }, 1350);
        }, 2000);
      };
    });
  }

  // Konvertni parchalarga bo'lib sochish
  function shatter(env) {
    const r = env.getBoundingClientRect();
    const layer = $('shards'); layer.innerHTML = '';
    const COLS = 5, ROWS = 3, cw = r.width / COLS, ch = r.height / ROWS;
    const fills = ['linear-gradient(170deg,#f7e4db,#e6c1b6)', 'linear-gradient(160deg,#f4ddd3,#d9b1a6)', 'linear-gradient(180deg,#f1d3c8,#ddb3a7)'];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      // Har bir katakni ikki uchburchakka bo'lamiz, uchlarini biroz qiyshaytiramiz
      const j = () => (Math.random() - 0.5) * 0.35;
      const tris = Math.random() < 0.5
        ? [[[0, 0], [1, 0], [0, 1]], [[1, 0], [1, 1], [0, 1]]]
        : [[[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 1], [0, 1]]];
      tris.forEach((t) => {
        const el = document.createElement('div');
        el.className = 'shard';
        const pts = t.map(([a, b]) => [(x + a + (a % 1 ? 0 : j() * (x + a > 0 && x + a < COLS))) * cw, (y + b + j() * (y + b > 0 && y + b < ROWS)) * ch]);
        const cx = pts.reduce((s, q) => s + q[0], 0) / 3, cy = pts.reduce((s, q) => s + q[1], 0) / 3;
        Object.assign(el.style, {
          left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
          background: fills[(Math.random() * fills.length) | 0],
          clipPath: `polygon(${pts.map(([a, b]) => `${a}px ${b}px`).join(',')})`,
          transformOrigin: `${cx}px ${cy}px`,
        });
        layer.appendChild(el);
        const ang = Math.atan2(cy - r.height / 2, cx - r.width / 2) + (Math.random() - 0.5) * 0.8;
        const dist = 160 + Math.random() * 260;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          el.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 120}px) rotate(${(Math.random() - 0.5) * 540}deg) scale(${0.5 + Math.random() * 0.4})`;
          el.style.opacity = '0';
        }));
      });
    }
    addPetals(24, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    setTimeout(() => { layer.innerHTML = ''; }, 1800);
  }

  // ---------- 2. Ovozli tabrik ----------
  let voice = null;
  function stopVoice() { if (voice) { voice.pause(); voice = null; duck(1); $('voiceBtn').classList.remove('playing'); } }
  $('voiceBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (voice) return stopVoice();
    voice = new Audio(C.ovozliTabrik);
    duck(0.12); $('voiceBtn').classList.add('playing');
    voice.onended = stopVoice;
    voice.play().catch(stopVoice);
  });

  function typeText(text, id) {
    const el = $('msg'); const chars = [...text]; let i = 0;
    el.textContent = ''; el.classList.remove('done');
    const step = () => {
      if (id !== runId) return;
      el.textContent += chars[i++] || '';
      if (i < chars.length) typeTimer = setTimeout(step, chars[i - 1] === '.' || chars[i - 1] === '!' ? 260 : 38);
      else { el.classList.add('done'); $('sign').textContent = '— ' + C.kimdan; $('sign').classList.add('on'); $('card').classList.remove('writing'); }
      el.scrollTop = el.scrollHeight;
    };
    step();
  }

  // Yakuniy ekranda bosilgan joyda salyut
  addEventListener('pointerdown', (e) => {
    if (!finalMode || e.target.closest('.card') || e.target.closest('.letter')) return;
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
    if (actx) { master.gain.value = musicOn ? 0.55 : 0; clearTimeout(musicTimer); if (musicOn) startSong(); }
  });

  // ---------- 6. Kunga qarab salomlashish ----------
  const hr = new Date().getHours();
  const greet = hr >= 5 && hr < 11 ? 'Xayrli tong' : hr < 17 && hr >= 11 ? 'Xayrli kun' : hr >= 17 && hr < 23 ? 'Xayrli kech' : 'Tun yarmida ham';
  const gEmoji = hr >= 5 && hr < 11 ? '☀️' : hr >= 11 && hr < 17 ? '🌤️' : '🌙';
  $('greet').textContent = `${greet}, ${C.ism} ${gEmoji}`;

  // ---------- 7. Kutish rejimi: tug'ilgan kunidan oldin ochilmaydi ----------
  function birthdayStart() {
    const m = String(C.sana || '').trim().match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const now = new Date();
    return new Date(m[1] ? +m[1] : now.getFullYear(), +m[2] - 1, +m[3]);
  }
  const bday = birthdayStart();
  const bypass = /[?&](ochish|test)\b/.test(location.search);
  if (bday && Date.now() < bday.getTime() && !bypass && !C.xotira) {
    $('start').classList.remove('on');
    $('wait').classList.add('on');
    $('waitName').textContent = `Hali erta, ${C.ism} 🤫`;
    const pad = (n) => String(n).padStart(2, '0');
    await new Promise((res) => {
      const tick = () => {
        const ms = bday.getTime() - Date.now();
        if (ms <= 0) return res();
        const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, mi = Math.floor(ms / 6e4) % 60, se = Math.floor(ms / 1e3) % 60;
        $('wDays').textContent = d; $('wH').textContent = pad(h); $('wM').textContent = pad(mi); $('wS').textContent = pad(se);
        setTimeout(tick, 1000);
      };
      tick();
    });
    $('wait').classList.remove('on');
    $('start').classList.add('on');
    addConfetti(150);
  }

  if (!memMode && document.fonts && document.fonts.load) {
    await Promise.race([
      Promise.all([
        document.fonts.load("40px 'Great Vibes'"),
        document.fonts.load("italic 500 40px 'Playfair Display'"),
        document.fonts.load("500 40px 'Playfair Display'"),
      ]).catch(() => {}),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }

  const btn = $('startBtn');
  btn.disabled = false; btn.textContent = 'Ochish ✨';
  let opened = false, musicStarted = false;
  const startMusic = (mode = 'hb') => {
    if (musicStarted) { if (mode !== songMode) startSong(mode); return; }
    musicStarted = true;
    initAudio(); if (actx && actx.resume) actx.resume();
    if (audio) audio.play().catch(() => {}); else startSong(mode);
    const mb = $('mMusic'); if (mb) mb.classList.add('gone');
  };
  btn.addEventListener('click', async () => {
    if (opened) return; opened = true;
    startMusic('hb');
    $('start').classList.add('opening');
    buzz(30);
    const g = $('gift').getBoundingClientRect();
    setTimeout(() => {
      const x = g.left + g.width / 2, y = g.top + g.height / 2;
      burst(x, y, 42); burst(x, y, 30); flash = 0.15;
    }, 650);
    setTimeout(() => { $('start').classList.remove('on'); muteBtn.classList.add('on'); }, 900);
    setTimeout(run, 1500);
  });

  // ================= Xotira sahifasi (hammasi bitta sahifada) =================
  const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const memory = $('memory');
  let memoryBuilt = false;
  function buildMemory() {
    if (memoryBuilt) return; memoryBuilt = true;
    $('mName').textContent = C.ism;
    const parts2 = [];
    if (C.yosh) parts2.push(`${C.yosh} yosh`);
    if (bday) parts2.push(`${bday.getDate()}-${MONTHS[bday.getMonth()]}, ${bday.getFullYear()}`);
    $('mTg').addEventListener('click', (e) => e.stopPropagation());
    $('mDate').textContent = parts2.join(' · ');
    const st = $('mStatus');
    if (bday) {
      const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate()) {
        st.textContent = 'Bugun sizning kuningiz 🎉';
      } else {
        let next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
        if (next <= today) next = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
        const days = Math.round((next - today) / 864e5);
        st.textContent = C.yosh ? `${+C.yosh + 1} yoshgacha: ${days} kun ⏳` : `Keyingi tug'ilgan kuningizgacha: ${days} kun ⏳`;
      }
    } else st.hidden = true;

    // Kino titrlari
    const nCandles = C.yosh ? String(C.yosh).length : 3;
    const credits = [
      ['Bosh qahramon', C.ism],
      ["G'oya va muallif", C.kimdan],
      ['Yulduzlar', `${N.toLocaleString('ru-RU')} ta`],
      ['Atirgullar', '10 ta'],
      ['Shamlar', `${nCandles} ta`],
      ['Xotiralar', `${gImgs.length} ta surat`],
      ['Tilaklar', 'cheksiz ✨'],
    ];
    // Ikki marta qo'yamiz — titrlar uzluksiz aylanadi
    const cr = $('mCredits');
    [0, 1].forEach(() => credits.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'm-cr';
      row.innerHTML = '<span></span><b></b>';
      row.firstChild.textContent = k; row.lastChild.textContent = v;
      cr.appendChild(row);
    }));

    // Hayot hisoblagichi: tug'ilgan paytdan beri
    if (bday && C.yosh) {
      const birth = new Date(bday.getFullYear() - +C.yosh, bday.getMonth(), bday.getDate());
      const fmt = (n) => n.toLocaleString('ru-RU');
      const tick = () => {
        const ms = Date.now() - birth.getTime();
        $('lcD').textContent = fmt(Math.floor(ms / 864e5));
        $('lcH').textContent = fmt(Math.floor(ms / 36e5));
        $('lcS').textContent = fmt(Math.floor(ms / 1e3));
      };
      tick(); setInterval(tick, 1000);
    } else $('mLife').hidden = true;
    $('mClosing').textContent = C.yakunMatni || '';
    const tg = String(C.telegram || '').replace(/^@|^https?:\/\/t\.me\//, '');
    if (tg) { $('mTg').href = 'https://t.me/' + tg; $('mTg').textContent = `💬 ${C.kimdan}ga javob yozish`; } else $('mTg').hidden = true;

    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('vis');
      io.unobserve(en.target);
    }), { root: memory, threshold: 0.15 });
    memory.querySelectorAll('.m-sec').forEach((el) => io.observe(el));
  }
  function showMemory() {
    buildMemory();
    $('start').classList.remove('on'); $('wait').classList.remove('on');
    memory.classList.add('on'); memory.scrollTop = 0;
    muteBtn.classList.add('on');
    petalRain = true; meteorSky = true;
    setTimeout(() => meteor(), 1800);
  }
  memory.addEventListener('pointerdown', () => startMusic('end'));
  $('mMusic').addEventListener('click', (e) => { e.stopPropagation(); startMusic('end'); });
  // Osmonga tegilsa — uchar yulduz
  memory.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    meteor(e.clientX + 140, e.clientY - 140);
    if (actx && musicOn) [84, 88, 91].forEach((n, i) => bell(actx.currentTime + i * 0.07, NOTE(n), 1.2, 0.06));
  });
  $('mReplay').addEventListener('click', (e) => {
    e.stopPropagation();
    memory.classList.remove('on'); petalRain = false; meteorSky = false;
    startMusic('hb');
    current = null; dissolve();
    setTimeout(run, 600);
  });
  $('homeBtn').hidden = !C.xotira;
  $('homeBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    runId++; resetUI(); current = null; dissolve();
    showMemory();
    if (musicStarted) startSong('end');
  });

  if (memMode) showMemory();
})();
