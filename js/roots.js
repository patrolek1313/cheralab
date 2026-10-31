/* Chera Lab - żywe korzenie nad kafelkami 01/02/03
   Rysowane na canvasie: zwężające się, rozgałęzione korzenie, które rosną przy przewijaniu,
   sięgają w stronę kursora, a po najechaniu na kafelek (lub korzeń) podświetlają swoją gałąź
   i puszczają po niej "sok" od pnia do kafelka. */
(() => {
  const m = document.getElementById('rootsMap');
  if (!m) return;
  const old = m.querySelector('.roots-svg'); if (old) old.remove();
  const cv = document.createElement('canvas');
  cv.className = 'roots-cv'; cv.setAttribute('aria-hidden', 'true');
  m.prepend(cv);
  const ctx = cv.getContext('2d');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tiles = [...m.querySelectorAll('.lab-item')];

  let W = 0, H = 0, dpr = 1, roots = [], mains = [], maxO = 1;
  let grow = 0, growT0 = null, hover = 0, raf = 0, visible = false;
  let mouse = null, mi = 0;                 // pozycja kursora i siła jego wpływu (wygładzona)
  let pulse = 0, pulseT0 = 0;

  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- budowa korzeni ---------- */
  function build() {
    const r = rng(1313);
    const box = m.getBoundingClientRect();
    W = Math.round(box.width);
    H = Math.round(parseFloat(getComputedStyle(m).paddingTop)) || 0;
    if (!W || !H) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = W * dpr; cv.height = (H + 8) * dpr;
    cv.style.width = W + 'px'; cv.style.height = (H + 8) + 'px';
    roots = []; mains = [];

    const cx = W / 2, jy = H * 0.22, step = Math.max(4, W / 260);
    const S = Math.min(1.25, Math.max(.7, W / 1100));   // skala grubości

    // jeden korzeń: błądzenie losowe z naciskiem na cel lub w dół, z rozgałęzieniami
    function grow1(x, y, ang, len, w0, g, depth, o0, target) {
      const pts = [];
      const n = Math.max(3, Math.round(len / step));
      let a = ang;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const w = Math.max(.35, w0 * Math.pow(1 - k, .85));
        pts.push({ x, y, w, o: o0 + i * step, fx: Math.min(1, 1.6 / w) });
        if (i === n) break;
        a += (r() - .5) * (depth ? .55 : .32);
        if (target) {
          const want = Math.atan2(target.y - y, target.x - x);
          let d = want - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          a += d * (.06 + .5 * k * k);
        } else {
          let d = Math.PI / 2 - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          a += d * .025;                       // lekka grawitacja
        }
        x += Math.cos(a) * step; y += Math.sin(a) * step;
        if (!target && (y > H + 4 || y < jy * .6)) break;
        if (target) {
          const reached = target.y > H ? y >= target.y : Math.hypot(target.x - x, target.y - y) < step * 1.5;
          if (reached) { pts.push({ x: target.x, y: target.y, w: .5, o: o0 + (i + 1) * step, fx: 1 }); break; }
        }
        // rozgałęzienia
        if (depth < 3 && w > .9 && r() < (depth ? .07 : .09) && i > 3) {
          const side = r() < .5 ? -1 : 1;
          grow1(x, y, a + side * (.45 + r() * .75), len * (1 - k) * (.35 + r() * .45), w * (.5 + r() * .15), g, depth + 1, o0 + i * step, null);
        }
      }
      roots.push({ pts, g, depth, main: !!target && depth === 0 });
      return pts;
    }

    // pień - rozszerzona podstawa schodząca do węzła
    const tr = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      tr.push({ x: cx + Math.sin(k * 3) * 1.5, y: lerp(-6, jy, k), w: lerp(30, 15, Math.pow(k, .7)) * S, o: k * jy, fx: 0 });
    }
    roots.push({ pts: tr, g: 0, depth: 0, trunk: true });

    // trzy główne korzenie do kafelków
    const mb = box;
    tiles.forEach((t, i) => {
      const b = t.getBoundingClientRect();
      const tx = b.left - mb.left + b.width / 2;
      const ang = Math.atan2(H - jy, tx - cx) + (r() - .5) * .3;
      const len = Math.hypot(tx - cx, H - jy) * 1.6;
      mains[i] = grow1(cx + (tx - cx) * .02, jy, ang, len, 11 * S, i + 1, 0, jy, { x: tx, y: H + 2 });
    });

    // korzenie boczne rozchodzące się płytko na boki (jak u prawdziwego drzewa)
    [[-1, .18], [1, .18], [-1, .5], [1, .5], [-1, .9], [1, .9]].forEach(([s, d]) => {
      grow1(cx + s * 4, jy + 4 + d * 14, s < 0 ? Math.PI - (.3 + d * .55) : .3 + d * .55, W * (.22 + r() * .2), (5 - d * 2) * S, 0, 1, jy * .8, null);
    });

    // połączenia między sąsiednimi korzeniami - "w mojej głowie nie ma szufladek"
    const link = (a, b, g) => {
      if (!mains[a] || !mains[b]) return;
      const pa = mains[a][Math.floor(mains[a].length * (.55 + r() * .1))];
      const pb = mains[b][Math.floor(mains[b].length * (.62 + r() * .1))];
      const p = grow1(pa.x, pa.y, Math.atan2(pb.y - pa.y, pb.x - pa.x) + (r() < .5 ? -.6 : .6), Math.hypot(pb.x - pa.x, pb.y - pa.y) * 1.6, 1.6 * S, g, 2, pa.o, { x: pb.x, y: pb.y });
      roots[roots.length - 1].link = true;
    };
    link(0, 1, 'l12'); link(1, 2, 'l23');

    maxO = Math.max(...roots.map(rt => rt.pts[rt.pts.length - 1].o));
    roots.sort((a, b) => (b.depth - a.depth));          // cienkie pod spodem, grube na wierzchu
    return true;
  }

  /* ---------- rysowanie ---------- */
  const COL_THICK = [104, 116, 88], COL_THIN = [190, 199, 168], COL_HI = [222, 230, 200];
  // kolory nieprzezroczyste (zmieszane z tłem) - bez "koralików" na nakładających się odcinkach
  const BG = [21, 34, 28];
  const lerpC = (a, b, t) => a.map((v, j) => lerp(v, b[j], t));
  const mix = (c, a) => { const q = lerpC(BG, c, Math.max(0, Math.min(1, a))); return `rgb(${q[0] | 0},${q[1] | 0},${q[2] | 0})`; };
  const inGroup = (g, h) => g === h || (g === 'l12' && (h === 1 || h === 2)) || (g === 'l23' && (h === 2 || h === 3));

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H + 8);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const G = RM ? Infinity : grow * maxO;
    const mx = mouse ? mouse.x : -9999, my = mouse ? mouse.y : -9999, R = 150;

    for (const rt of roots) {
      const lit = hover && (rt.trunk || inGroup(rt.g, hover));
      const dim = hover && !lit;
      let base = rt.trunk ? .78 : rt.main ? .72 : rt.link ? .42 : .55 - rt.depth * .08;
      if (lit) base = rt.link ? .95 : 1; else if (dim) base *= .32;
      let px = null, py = null;
      for (let i = 0; i < rt.pts.length; i++) {
        const p = rt.pts[i];
        if (p.o > G) break;
        let x = p.x, y = p.y;
        if (mi > .01 && p.fx) {                 // korzonki sięgają w stronę kursora
          const dx = mx - x, dy = my - y, d = Math.hypot(dx, dy);
          if (d < R && d > 1) { const f = Math.pow(1 - d / R, 2) * 14 * p.fx * mi; x += dx / d * f; y += dy / d * f; }
        }
        if (px !== null) {
          // grubość rośnie razem z "czubkiem" podczas wzrostu
          const tip = Math.min(1, (G - p.o) / 60);
          const w = p.w * (RM ? 1 : .35 + .65 * tip);
          const k = Math.min(1, w / 9);
          const c = lit ? COL_HI.map((v, j) => lerp(v, COL_THICK[j] + 40, k * .5)) : COL_THIN.map((v, j) => lerp(v, COL_THICK[j], k));
          const fade = rt.trunk ? Math.min(1, Math.max(0, (p.y + 6) / (H * .16))) : 1;
          ctx.strokeStyle = mix(c, base * fade);
          ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
        }
        px = x; py = y;
      }
    }

    // sok płynący od pnia do podświetlonego kafelka
    if (hover && mains[hover - 1] && !RM) {
      const path = mains[hover - 1], o0 = path[0].o, o1 = path[path.length - 1].o;
      const t = ((now - pulseT0) % 1700) / 1700;
      const target = lerp(0, o1, t);
      let p = path[0];
      for (const q of path) { if (q.o + 0 >= Math.max(o0, target)) { p = q; break; } }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22);
      g.addColorStop(0, 'rgba(235,242,215,.85)'); g.addColorStop(.35, 'rgba(200,210,175,.35)'); g.addColorStop(1, 'rgba(200,210,175,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------- pętla animacji (działa tylko, gdy coś się rusza) ---------- */
  function tick(now) {
    raf = 0;
    let busy = false;
    if (growT0 !== null && grow < 1) {
      const t = Math.min(1, (now - growT0) / 3200);
      grow = 1 - Math.pow(1 - t, 3); busy = grow < 1;
    }
    const want = mouse ? 1 : 0;
    if (Math.abs(mi - want) > .01) { mi = lerp(mi, want, .12); busy = true; } else mi = want;
    if (hover && !RM) busy = true;
    draw(now);
    if (busy && visible) raf = requestAnimationFrame(tick);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function setHover(h) {
    if (h === hover) return;
    hover = h; pulseT0 = performance.now();
    if (h) m.dataset.on = h; else delete m.dataset.on;
    kick();
  }

  /* ---------- zdarzenia ---------- */
  tiles.forEach(t => {
    const r = +t.dataset.r;
    t.addEventListener('mouseenter', () => setHover(r));
    t.addEventListener('focus', () => setHover(r));
    t.addEventListener('mouseleave', () => setHover(0));
    t.addEventListener('blur', () => setHover(0));
  });
  m.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const b = m.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    if (y > H + 6) { if (mouse) { mouse = null; kick(); } return; }
    mouse = { x, y };
    // najechanie na sam korzeń podświetla jego kafelek
    let best = 0, bd = 26;
    mains.forEach((path, i) => { for (let j = 0; j < path.length; j += 2) { const d = Math.hypot(path[j].x - x, path[j].y - y); if (d < bd) { bd = d; best = i + 1; } } });
    setHover(best);
    kick();
  });
  m.addEventListener('pointerleave', () => { mouse = null; setHover(0); kick(); });

  const io = new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    if (visible) {
      if (growT0 === null) { growT0 = performance.now(); m.classList.add('grown'); }
      kick();
    }
  }), { threshold: .2 });

  let rt = 0;
  const rebuild = () => { if (build()) { if (!visible) draw(performance.now()); kick(); } };
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rebuild, 120); }).observe(m);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  rebuild();
  io.observe(m);
})();
