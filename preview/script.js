(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav ---------- */
  const nav = $('#nav'), toggle = $('#navToggle'), menu = $('#navMenu');
  const setMenuOpen = open => {
    menu.classList.toggle('is-open', open);
    nav.classList.toggle('is-menu-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  /* Header stays fixed always — only toggle solid bar styling, never hide */
  const onScroll = () => {
    if (menu.classList.contains('is-open')) return;
    nav.classList.toggle('is-scrolled', scrollY > 40);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  toggle.addEventListener('click', () => setMenuOpen(!menu.classList.contains('is-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenuOpen(false)));
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenuOpen(false);
  });
  const sectionLinks = $$('a[href^="#"]', menu);
  const spy = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    sectionLinks.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  sectionLinks.forEach(a => { const t = $(a.getAttribute('href')); if (t) spy.observe(t); });

  /* ---------- Reveal + counters ---------- */
  const countUp = el => {
    const to = +el.dataset.to, start = performance.now(), dur = 1600;
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-visible');
    $$('.counter', e.target).forEach(c => { if (!c.dataset.done) { c.dataset.done = 1; countUp(c); } });
    io.unobserve(e.target);
  }), { threshold: .15 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(el); });

  /* ---------- Hero smoke ---------- */
  const canvas = $('#smoke');
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext('2d');
    let w, h, puffs = [];
    const resize = () => { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; };
    resize(); addEventListener('resize', resize);
    const spawn = () => ({
      x: w * (.35 + Math.random() * .3), y: h + 40, r: 40 + Math.random() * 80,
      vx: (Math.random() - .5) * .35, vy: -(.25 + Math.random() * .45), a: 0, life: 0, max: 600 + Math.random() * 500
    });
    for (let i = 0; i < 24; i++) { const p = spawn(); p.y = Math.random() * h; p.life = Math.random() * p.max; puffs.push(p); }
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
    const draw = () => {
      if (visible) {
        ctx.clearRect(0, 0, w, h);
        puffs.forEach((p, i) => {
          p.life++; p.x += p.vx + Math.sin(p.life / 90) * .25; p.y += p.vy; p.r += .12;
          const t = p.life / p.max; p.a = Math.sin(Math.PI * t) * .09;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(240,220,190,${p.a})`); g.addColorStop(1, 'rgba(240,220,190,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          if (t >= 1 || p.y < -p.r) puffs[i] = spawn();
        });
      }
      requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------- Singing bowl (Web Audio, no files) ---------- */
  let audioCtx = null, soundOn = false;
  const chime = (pitch = 1) => {
    if (!soundOn || !audioCtx) return;
    const now = audioCtx.currentTime, base = 196 * pitch, out = audioCtx.createGain();
    out.gain.value = .18; out.connect(audioCtx.destination);
    [[1, 1], [2.76, .45], [5.4, .2], [8.9, .08]].forEach(([ratio, amp], n) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = base * ratio;
      o.detune.value = n ? Math.random() * 8 - 4 : 0;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(amp, now + .02);
      g.gain.exponentialRampToValueAtTime(.0001, now + 4.5 / (1 + n * .6));
      o.connect(g).connect(out); o.start(now); o.stop(now + 5);
    });
  };
  const soundBtn = $('#soundToggle');
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn && !audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx?.resume();
    soundBtn.setAttribute('aria-pressed', soundOn);
    $('#soundLabel').textContent = soundOn ? 'Bowl on' : 'Bowl off';
    chime();
  });

  /* ---------- Breath guide ---------- */
  const patterns = {
    calm: [['Breathe in', 4, 'in'], ['Breathe out', 6, 'out']],
    box: [['Breathe in', 4, 'in'], ['Hold', 4, 'in'], ['Breathe out', 4, 'out'], ['Hold', 4, 'out']],
    connected: [['Breathe in', 3, 'in'], ['Let go', 3, 'out']]
  };
  let pattern = 'calm', running = false, timer = null, cycles = 0;
  const orb = $('#orb'), core = $('.orb__core', orb), label = $('#orbLabel'), count = $('#orbCount'),
        startBtn = $('#breathStart'), cyclesEl = $('#breathCycles');
  const runPhase = idx => {
    const steps = patterns[pattern], [text, secs, dir] = steps[idx % steps.length];
    if (idx % steps.length === 0 && idx > 0) cyclesEl.textContent = `${++cycles} breath${cycles === 1 ? '' : 's'}`;
    label.textContent = text;
    if (text !== 'Hold') chime(dir === 'in' ? 1.125 : 1);
    core.style.transitionDuration = secs + 's';
    orb.classList.toggle('is-in', dir === 'in');
    let left = secs; count.textContent = left;
    clearInterval(timer);
    timer = setInterval(() => {
      left--;
      if (left > 0) count.textContent = left;
      else { clearInterval(timer); if (running) runPhase(idx + 1); }
    }, 1000);
  };
  const stopBreath = () => {
    running = false; clearInterval(timer);
    orb.classList.remove('is-in'); core.style.transitionDuration = '1.5s';
    label.textContent = 'Ready'; count.textContent = ''; startBtn.textContent = 'Begin';
  };
  startBtn.addEventListener('click', () => {
    if (running) return stopBreath();
    running = true; cycles = 0; cyclesEl.textContent = '0 breaths'; startBtn.textContent = 'Rest';
    runPhase(0);
  });
  $$('.chip').forEach(chip => chip.addEventListener('click', () => {
    $$('.chip').forEach(c => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-checked', c === chip); });
    pattern = chip.dataset.pattern;
    if (running) { cycles = 0; cyclesEl.textContent = '0 breaths'; runPhase(0); }
  }));

  /* ---------- Breathwork styles ---------- */
  const art = {
    waves: `<svg viewBox="0 0 200 200" fill="none" stroke="#e2b56b" stroke-width="1.2">${[...Array(11)].map((_, i) =>
      `<path opacity="${1 - i * .07}" d="M10 ${40 + i * 12} Q55 ${20 + i * 12} 100 ${40 + i * 12} T190 ${40 + i * 12}"/>`).join('')}</svg>`,
    tree: `<svg viewBox="0 0 200 200" fill="none" stroke="#e2b56b" stroke-width="1.2">
      <circle cx="100" cy="45" r="32" opacity=".5"/><path d="M100 170V60M100 95l-35-30M100 95l35-30M100 75l-20-25M100 75l20-25"/>
      <path d="M100 170l-40 22M100 170l40 22M100 170l-18 26M100 170l18 26" opacity=".7"/>
      <line x1="20" y1="120" x2="180" y2="120" stroke-dasharray="3 5" opacity=".5"/><line x1="20" y1="170" x2="180" y2="170" stroke-dasharray="3 5" opacity=".5"/>
      <text x="22" y="40" fill="#c9b79e" stroke="none" font-size="10" font-family="Jost">CELESTIAL</text>
      <text x="22" y="140" fill="#c9b79e" stroke="none" font-size="10" font-family="Jost">EARTHLY</text>
      <text x="22" y="188" fill="#c9b79e" stroke="none" font-size="10" font-family="Jost">UNDERWORLD</text></svg>`,
    spiral: `<svg viewBox="0 0 200 200" fill="none" stroke="#e2b56b" stroke-width="1.2"><path d="${(() => {
      let d = 'M100 100'; for (let t = 0; t < 26; t += .15) d += ` L${100 + Math.cos(t) * t * 3.4} ${100 + Math.sin(t) * t * 3.4}`; return d; })()}"/></svg>`,
    vortex: `<svg viewBox="0 0 200 200" fill="none" stroke="#e2b56b" stroke-width="1">${[...Array(12)].map((_, i) =>
      `<ellipse cx="100" cy="100" rx="85" ry="28" transform="rotate(${i * 15} 100 100)" opacity=".6"/>`).join('')}<circle cx="100" cy="100" r="8" fill="#e2b56b"/></svg>`,
    horizon: `<svg viewBox="0 0 200 200" fill="none" stroke="#e2b56b" stroke-width="1.2"><line x1="10" y1="140" x2="190" y2="140"/>
      <circle cx="100" cy="140" r="40"/>${[...Array(9)].map((_, i) => { const a = Math.PI + (i + 1) * Math.PI / 10;
      return `<line x1="${100 + Math.cos(a) * 52}" y1="${140 + Math.sin(a) * 52}" x2="${100 + Math.cos(a) * 80}" y2="${140 + Math.sin(a) * 80}"/>`; }).join('')}
      <path d="M40 165h120M65 182h70" opacity=".5"/></svg>`
  };
  const styles = [
    { tag: 'A turbo-boost for meditation', title: '44 Breaths', art: 'waves',
      text: 'A quick and effective “turbo-boost” for your meditation practice — a simple, focused method of entering a deep state of connection that can be practiced several times a day.',
      video: ['Gy1TEpTMGig', '44 Breaths — 15 minute breathwork meditation'] },
    { tag: 'Building the spiritual body', title: 'The Cosmic Tree', art: 'tree',
      text: 'Builds your spiritual body on Three Planes — the Underworld, Earthly World and Celestial Realm — which correspond to our unconscious, physical and spiritual aspects.' },
    { tag: 'Surrender & trust', title: 'Intuitive Breathwork', art: 'spiral',
      text: 'A free-form style practiced lying down. Non-directive, so you go where you need to go. It teaches surrender and trust in the Divine, tanks you up on prana, purifies your being and brings bursts of inspiration.' },
    { tag: 'Breath & music', title: 'Ecstatic Breathwork', art: 'vortex',
      text: 'Accesses deep, transpersonal states by combining breathwork and music — helping you enter a vortex of ecstasy and spiritual communion.' },
    { tag: 'Insight from your Chosen Future', title: 'Future Tapping', art: 'horizon',
      text: 'Combines breathwork and visualisation to tap the energy and insight of your Chosen Future. Accessing the potential of the future brings insight into the NOW. Showcased at The Breathing Festival 2021.' }
  ];
  const panel = $('#stylePanel'), styleLink = $('#styleLink');
  const showStyle = i => {
    const s = styles[i];
    panel.classList.add('is-swapping');
    setTimeout(() => {
      $('#styleArt').innerHTML = art[s.art];
      $('#styleTag').textContent = s.tag; $('#styleTitle').textContent = s.title; $('#styleText').textContent = s.text;
      styleLink.hidden = !s.video;
      if (s.video) { styleLink.textContent = '▶ Practice along with Jacques'; styleLink.onclick = e => { e.preventDefault(); openVideo(...s.video); }; }
      panel.classList.remove('is-swapping');
    }, 220);
  };
  const tabs = $$('.styles__tabs button');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(b => b.setAttribute('aria-selected', b === t)); showStyle(+t.dataset.style);
  }));
  showStyle(0);

  /* ---------- Oracle ---------- */
  const mandala = (size = 150) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="#e2b56b" stroke-width=".6">
    ${[...Array(12)].map((_, i) => `<ellipse cx="50" cy="32" rx="9" ry="20" transform="rotate(${i * 30} 50 50)"/>`).join('')}
    <circle cx="50" cy="50" r="12"/><circle cx="50" cy="50" r="46" opacity=".5"/></svg>`;
  $('#cardMandala').innerHTML = mandala();
  // Jacques' own oil-painted cards from the Classical Mythology Deck
  const gods = [
    { f: '01-zeus', n: 'Zeus', k: 'Sovereignty · Vision · Leadership',
      t: 'Step into your authority. Zeus asks you to see the larger picture and make the decision you have been circling.', a: 'I lead my life with clarity and generous vision.' },
    { f: '02-hera', n: 'Hera', k: 'Commitment · Dignity · Partnership',
      t: 'Honour your commitments — and expect them to be honoured in return. Self-respect is the foundation of true union.', a: 'I am worthy of loyal, devoted love.' },
    { f: '03-athena', n: 'Athena', k: 'Strategy · Clarity · Craft',
      t: 'Bring a clear mind to the situation. A calm strategy will serve you better than force — especially in your work and career.', a: 'Wisdom guides every step I take.' },
    { f: '04-hermes', n: 'Hermes', k: 'Communication · Travel · Wit',
      t: 'Messages and crossroads. Stay curious, communicate openly and be ready for a journey — inner or outer — that opens new doors.', a: 'I move with ease between worlds.' },
    { f: '05-hephaistos', n: 'Hephaistos', k: 'Craft · Resilience · Creation',
      t: 'Your wounds can become your craft. Stay with the patient work at the forge — something enduring is being shaped through you.', a: 'I transform my challenges into creations of value.' },
    { f: '06-hestia', n: 'Hestia', k: 'Centre · Devotion · Home',
      t: 'Come home to your centre. Tend the inner flame through quiet daily devotion; this simple practice is your sanctuary.', a: 'My inner flame burns steady and bright.' },
    { f: '07-apollo', n: 'Apollo', k: 'Truth · Healing · Inspiration',
      t: 'Let the light in. Speak your truth, follow what inspires you, and allow your creativity to become a healing force.', a: 'I shine my light and speak my truth.' },
    { f: '08-ares', n: 'Ares', k: 'Courage · Action · Boundaries',
      t: 'It is time to act. Channel fire into courageous, clean action, and hold your boundaries with strength rather than anger.', a: 'I act with courage and integrity.' },
    { f: '09-poseidon', n: 'Poseidon', k: 'Emotion · Depth · Power',
      t: 'Deep emotional tides are moving. Rather than resisting the waves, breathe and let them carry what is ready to be released.', a: 'I ride my emotions with trust and strength.' },
    { f: '10-aphrodite', n: 'Aphrodite', k: 'Love · Beauty · Pleasure',
      t: 'Open to beauty and pleasure. Love begins in how you treat yourself — let yourself be seen, adored and delighted.', a: 'I am love, and I attract love.' },
    { f: '11-artemis', n: 'Artemis', k: 'Independence · Wilderness · Focus',
      t: 'Return to wild places, outside and within. Protect your solitude and aim your arrow at what truly matters to you.', a: 'I am free, focused and whole in myself.' },
    { f: '12-eros-phanes', n: 'Eros-Phanes', k: 'Creative Force · Emergence · Desire',
      t: 'Something new is hatching from the cosmic egg. Follow the primal pull of what genuinely magnetises you — it is the force that brings worlds into being.', a: 'I follow the creative pull of my heart.' },
    { f: '13-hades', n: 'Hades', k: 'Depth · The Unseen · Hidden Riches',
      t: 'Go beneath the surface. What lies in the underworld of the unconscious holds great wealth — face it, and reclaim your power.', a: 'I find treasure in my depths.' },
    { f: '14-demeter', n: 'Demeter', k: 'Nurture · Abundance · Cycles',
      t: 'A season of nourishment. Tend to your body and what you are growing; every harvest follows its own natural timing.', a: 'I nourish myself and abundance flows to me.' },
    { f: '15-persephone', n: 'Persephone', k: 'Transformation · Seasons · Return',
      t: 'A descent before a return. Trust the cycle you are in — what was taken into darkness will rise again, changed and wiser.', a: 'I trust the seasons of my soul.' },
    { f: '16-dionysys', n: 'Dionysos', k: 'Ecstasy · Release · Rebirth',
      t: 'Loosen your grip. Music, dance and the breath can carry you beyond the mind into joyful release and renewal.', a: 'I surrender to the joy of being alive.' }
  ];
  const cardSrc = g => `img/cards/card-${g.f}.jpg`;
  // Preload the paintings as the oracle nears view, so the flip is instant
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    gods.forEach(g => { new Image().src = cardSrc(g); }); obs.disconnect();
  }, { rootMargin: '400px' }).observe($('#deck'));

  const card = $('#oracleCard'), cardImg = $('#cardImg'), reading = $('#reading'), prompt = $('#oraclePrompt');
  let last = -1;
  const draw = () => {
    if (card.classList.contains('is-flipped')) return;
    let i; do { i = Math.floor(Math.random() * gods.length); } while (i === last); last = i;
    const g = gods[i];
    cardImg.src = cardSrc(g); cardImg.alt = `${g.n} — painted by Jacques Theron`;
    $('#readingName').textContent = g.n; $('#readingKeys').textContent = g.k;
    $('#readingText').textContent = g.t; $('#readingAff').textContent = `“${g.a}”`;
    card.classList.add('is-flipped'); card.setAttribute('aria-label', `${g.n} drawn`);
    prompt.textContent = 'Your card';
    setTimeout(() => { reading.hidden = false; }, 700);
  };
  card.addEventListener('click', draw);
  $('#drawAgain').addEventListener('click', () => {
    reading.hidden = true; card.classList.remove('is-flipped'); card.setAttribute('aria-label', 'Draw a card');
    prompt.textContent = 'Hold a question in your heart, then draw a card.';
  });

  /* ---------- YouTube (lightweight, loads on click) ---------- */
  const lightbox = $('#lightbox'), frame = $('#lightboxFrame');
  const iframe = id => `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="YouTube video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  function openVideo(id) { frame.innerHTML = iframe(id); lightbox.hidden = false; document.body.style.overflow = 'hidden'; }
  const closeVideo = () => { frame.innerHTML = ''; lightbox.hidden = true; document.body.style.overflow = ''; };
  $('#lightboxClose').addEventListener('click', closeVideo);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeVideo(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hidden) closeVideo(); });
  $$('.yt').forEach(el => {
    const { id, title, thumb } = el.dataset;
    el.style.backgroundImage = `url('${thumb || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`}')`;
    el.innerHTML = `<span class="yt__play"></span><span class="yt__title">${title}</span>`;
    el.setAttribute('role', 'button'); el.tabIndex = 0; el.setAttribute('aria-label', `Play video: ${title}`);
    const play = () => { el.classList.add('is-playing'); el.innerHTML = iframe(id); };
    el.addEventListener('click', play, { once: true });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
  });
  $$('.js-play').forEach(b => b.addEventListener('click', () => openVideo(b.dataset.id)));

  /* ---------- Testimonials ---------- */
  const quotes = $$('.quote'), dots = $('.carousel__dots');
  let qi = 0, qTimer;
  const showQuote = i => {
    qi = (i + quotes.length) % quotes.length;
    quotes.forEach((q, n) => q.classList.toggle('is-active', n === qi));
    $$('button', dots).forEach((d, n) => d.setAttribute('aria-selected', n === qi));
  };
  quotes.forEach((q, n) => {
    const b = document.createElement('button'); b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Testimonial ${n + 1}`);
    b.addEventListener('click', () => { showQuote(n); restart(); }); dots.append(b);
  });
  const restart = () => { clearInterval(qTimer); if (!reduceMotion) qTimer = setInterval(() => showQuote(qi + 1), 8000); };
  showQuote(0); restart();

  /* ---------- Local time for meet-ups (17:00 UTC) ---------- */
  const d = new Date(); d.setUTCHours(17, 0, 0, 0);
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' ');
  $('#localTime').textContent = `${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${tzName})`;

  /* ---------- Contact ---------- */
  const select = $('#subjectSelect');
  $$('[data-subject]').forEach(a => a.addEventListener('click', () => {
    const opt = [...select.options].find(o => o.text === a.dataset.subject);
    if (opt) select.value = opt.text;
  }));
  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const to = f.get('subject') === 'Bali Breathwork Retreat' ? 'mythicaljourneytours@gmail.com' : 'jacquestheron265@gmail.com';
    const body = `${f.get('message') || ''}\n\n— ${f.get('name')} (${f.get('email')})`;
    location.href = `mailto:${to}?subject=${encodeURIComponent(f.get('subject') + ' — via website')}&body=${encodeURIComponent(body)}`;
    $('#formNote').textContent = 'Your email app should open now — just press send. Thank you!';
  });

  /* ---------- Scroll progress ---------- */
  const bar = $('#progressBar');
  const onProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  };
  addEventListener('scroll', onProgress, { passive: true }); onProgress();

  /* ---------- Hero parallax ---------- */
  const hero = $('.hero');
  if (!reduceMotion && matchMedia('(pointer: fine)').matches) {
    const heroBg = $('.hero__bg'), heroContent = $('.hero__content');
    hero.addEventListener('mousemove', e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      heroBg.style.translate = `${x * -24}px ${y * -16}px`;
      heroContent.style.transform = `translate(${x * 12}px, ${y * 8}px)`;
    });
    hero.addEventListener('mouseleave', () => { heroBg.style.translate = ''; heroContent.style.transform = ''; });
  }

  /* ---------- Photo viewer (gallery + deck) ---------- */
  const viewer = $('#viewer'), vImg = $('#viewerImg'), vCap = $('#viewerCap');
  let vList = [], vIdx = 0, lastFocus = null;
  const showSlide = i => {
    vIdx = (i + vList.length) % vList.length;
    const { src, cap, alt } = vList[vIdx];
    vImg.style.animation = 'none'; void vImg.offsetWidth; vImg.style.animation = '';
    vImg.src = src; vImg.alt = alt || cap; vCap.textContent = cap;
  };
  const openViewer = (list, i) => {
    vList = list; lastFocus = document.activeElement;
    showSlide(i); viewer.hidden = false; document.body.style.overflow = 'hidden'; $('#viewerClose').focus();
  };
  const closeViewer = () => { viewer.hidden = true; document.body.style.overflow = ''; lastFocus?.focus(); };
  $('#viewerClose').addEventListener('click', closeViewer);
  $('#viewerPrev').addEventListener('click', () => showSlide(vIdx - 1));
  $('#viewerNext').addEventListener('click', () => showSlide(vIdx + 1));
  viewer.addEventListener('click', e => { if (e.target === viewer) closeViewer(); });
  addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') showSlide(vIdx - 1);
    if (e.key === 'ArrowRight') showSlide(vIdx + 1);
  });
  let touchX = null;
  viewer.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) showSlide(vIdx + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  const galleryItems = $$('.gallery__item');
  const galleryList = galleryItems.map(b => ({ src: $('img', b).src, cap: b.dataset.caption, alt: $('img', b).alt }));
  galleryItems.forEach((b, i) => b.addEventListener('click', () => openViewer(galleryList, i)));

  /* ---------- Deck fan ---------- */
  const fan = $('#fan');
  const deckList = gods.map(g => ({ src: cardSrc(g), cap: `${g.n} — ${g.k}`, alt: `${g.n}, painted by Jacques Theron` }));
  gods.forEach((g, i) => {
    const b = document.createElement('button');
    const mid = (gods.length - 1) / 2;
    b.className = 'fan__card';
    b.style.setProperty('--r', `${(i - mid) * 5.3}deg`);
    b.style.setProperty('--d', `${i * 35}ms`);
    b.style.zIndex = i;
    b.setAttribute('aria-label', `View ${g.n}`);
    b.innerHTML = `<img src="${cardSrc(g)}" alt="" loading="lazy">`;
    b.addEventListener('click', () => openViewer(deckList, i));
    fan.append(b);
  });
  new IntersectionObserver(([e], obs) => {
    if (e.isIntersecting) { setTimeout(() => fan.classList.add('is-open'), 250); obs.disconnect(); }
  }, { threshold: .4 }).observe(fan);

  /* ---------- Find your path quiz ---------- */
  const questions = [
    { q: 'What is calling you right now?', a: [
      ['✧', 'Healing an old wound or pattern', { breath: 2, hypno: 2 }],
      ['☉', 'Clarity about my path and future', { tarot: 2, hypno: 1 }],
      ['☽', 'A deeper spiritual connection', { breath: 2, bali: 1, camino: 1 }],
      ['∞', 'Community, adventure and renewal', { camino: 2, bali: 2, meetup: 1 }] ] },
    { q: 'How would you like to do this work?', a: [
      ['◯', 'One-to-one, privately', { breath: 1, hypno: 2, tarot: 2 }],
      ['❋', 'In a circle with others', { meetup: 2, breath: 1 }],
      ['⛰', 'On a journey somewhere sacred', { bali: 2, camino: 2 }],
      ['⌂', 'Gently, from home, to start', { meetup: 3, tarot: 1 }] ] },
    { q: 'How do you best receive insight?', a: [
      ['〰', 'Through my body and breath', { breath: 3, bali: 1 }],
      ['◐', 'Through my subconscious mind', { hypno: 3 }],
      ['✦', 'Through symbols, myth and story', { tarot: 3 }],
      ['❦', 'Through movement and nature', { camino: 3, bali: 1 }] ] }
  ];
  const results = {
    breath: { t: 'A Breathwork session', d: 'Ninety minutes of conversation and conscious breath that takes you into an altered state — the most direct route to release, healing and connection with your higher self.', s: 'Breathwork session', cta: 'Request a breathwork session' },
    hypno: { t: 'A Hypnosis session', d: 'Re-programme the subconscious mind at its roots. Hypnosis can resolve past trauma, unravel old patterns and bring a fresh vision for the future.', s: 'Hypnosis session', cta: 'Request a hypnosis session' },
    tarot: { t: 'A Tarot reading', d: 'The cards reveal the subconscious beliefs shaping your experience. When you understand your inner workings, you can change what unfolds next.', s: 'Tarot reading', cta: 'Request a reading' },
    bali: { t: 'The Bali Breathwork Retreat', d: 'Ten days of intensive breathwork in temples, waterfalls and holy sites on the Island of a Thousand Temples — the Magic & Mystery of Rebirth.', s: 'Bali Breathwork Retreat', cta: 'Ask about Bali dates' },
    camino: { t: 'The Camino de Santiago', d: 'Twenty-one days on foot with breathwork and ritual woven through the pilgrimage — a true initiation and the beginning of a new life.', s: 'Camino de Santiago pilgrimage', cta: 'Ask about the next Camino' },
    meetup: { t: 'The free Monday Meet-ups', d: 'A gentle place to begin: live, free conversations on Zoom about living spirituality, among a warm community. Pair it with the free 44 Breaths meditation.', s: 'Monday Meet-up', cta: 'Ask about the next meet-up' }
  };
  const stage = $('#quizStage'), quizBar = $('#quizBar');
  let qStep = 0, scores = {};
  const renderQ = () => {
    quizBar.style.width = `${(qStep / questions.length) * 100}%`;
    const { q, a } = questions[qStep];
    stage.innerHTML = `<div><p class="quiz__q">${q}</p><div class="quiz__opts">${a.map(([icon, label], i) =>
      `<button class="quiz__opt" data-i="${i}"><i aria-hidden="true">${icon}</i>${label}</button>`).join('')}</div></div>`;
    $$('.quiz__opt', stage).forEach(b => b.addEventListener('click', () => {
      Object.entries(a[b.dataset.i][2]).forEach(([k, v]) => { scores[k] = (scores[k] || 0) + v; });
      qStep++; qStep < questions.length ? renderQ() : renderResult();
    }));
  };
  const renderResult = () => {
    quizBar.style.width = '100%';
    const best = Object.entries(scores).sort((x, y) => y[1] - x[1])[0][0], r = results[best];
    stage.innerHTML = `<div class="quiz__result"><p class="eyebrow">Your path may begin with</p><h4>${r.t}</h4><p>${r.d}</p>
      <a href="#contact" class="btn btn--gold" data-subject="${r.s}">${r.cta}</a>
      <br><button class="quiz__restart">Start again</button></div>`;
    const cta = $('[data-subject]', stage);
    cta.addEventListener('click', () => { $('#subjectSelect').value = r.s; });
    $('.quiz__restart', stage).addEventListener('click', () => { qStep = 0; scores = {}; renderQ(); });
  };
  renderQ();

  $('#year').textContent = new Date().getFullYear();
})();
