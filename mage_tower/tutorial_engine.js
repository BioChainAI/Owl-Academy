(function () {
  'use strict';

  var cfg = window.TUTORIAL_CONFIG;
  if (!cfg || !cfg.slides || !cfg.slides.length) return;

  // ── Inject styles ──────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#tut-trigger{position:fixed;bottom:24px;right:24px;z-index:9000;width:48px;height:48px;',
    'border-radius:50%;background:linear-gradient(135deg,#1a0a2e,#2d1060);',
    'border:2px solid rgba(212,175,55,0.5);color:#D4AF37;font-size:18px;cursor:pointer;',
    'box-shadow:0 0 20px rgba(212,175,55,0.3);display:flex;align-items:center;',
    'justify-content:center;transition:all 0.2s;font-family:"JetBrains Mono",monospace;}',
    '#tut-trigger:hover{box-shadow:0 0 32px rgba(212,175,55,0.55);transform:scale(1.08);}',

    '#tut-backdrop{position:fixed;inset:0;z-index:9100;background:rgba(10,7,26,0.94);',
    'display:none;align-items:center;justify-content:center;padding:16px;}',
    '#tut-backdrop.open{display:flex;}',

    '#tut-card{background:linear-gradient(160deg,#0d0a1f 0%,#120920 100%);',
    'border:1px solid rgba(212,175,55,0.28);border-radius:16px;',
    'box-shadow:0 24px 64px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.05);',
    'width:100%;max-width:680px;overflow:hidden;position:relative;}',

    '#tut-header{display:flex;align-items:center;gap:12px;padding:18px 24px 14px;',
    'border-bottom:1px solid rgba(212,175,55,0.15);}',
    '#tut-owl-icon{width:32px;height:32px;flex-shrink:0;}',
    '#tut-title-text{font-family:"Cinzel",serif;font-size:0.85rem;letter-spacing:0.15em;',
    'color:#D4AF37;text-transform:uppercase;flex:1;}',
    '#tut-step-label{font-family:"JetBrains Mono",monospace;font-size:0.7rem;',
    'color:rgba(212,175,55,0.5);white-space:nowrap;}',
    '#tut-close{position:absolute;top:14px;right:16px;background:none;border:none;',
    'color:rgba(212,175,55,0.5);font-size:18px;cursor:pointer;line-height:1;',
    'transition:color 0.2s;}',
    '#tut-close:hover{color:#D4AF37;}',

    '#tut-body{display:flex;gap:0;min-height:240px;}',
    '#tut-avatar{width:120px;flex-shrink:0;display:flex;align-items:center;',
    'justify-content:center;padding:24px 16px;',
    'border-right:1px solid rgba(212,175,55,0.10);}',
    '#tut-avatar svg{width:80px;height:80px;}',

    '#tut-content{flex:1;padding:24px;}',
    '#tut-slide-heading{font-family:"Cinzel",serif;font-size:1.05rem;',
    'color:#FFF8DC;margin:0 0 10px;letter-spacing:0.05em;}',
    '#tut-slide-body{font-family:"Inter",sans-serif;font-size:0.88rem;',
    'line-height:1.75;color:#c8d0e0;margin:0 0 14px;}',
    '#tut-highlight{background:rgba(5,3,15,0.9);border-left:3px solid rgba(212,175,55,0.6);',
    'border-radius:0 6px 6px 0;padding:10px 14px;',
    'font-family:"JetBrains Mono",monospace;font-size:0.78rem;',
    'color:#D4AF37;white-space:pre-wrap;word-break:break-all;margin:0 0 14px;}',

    '#tut-footer{padding:16px 24px;border-top:1px solid rgba(212,175,55,0.10);',
    'display:flex;align-items:center;gap:12px;}',
    '#tut-dots{display:flex;gap:7px;flex:1;}',
    '.tut-dot{width:7px;height:7px;border-radius:50%;',
    'background:rgba(212,175,55,0.2);transition:background 0.2s;cursor:pointer;}',
    '.tut-dot.active{background:#D4AF37;}',
    '.tut-btn{font-family:"JetBrains Mono",monospace;font-size:0.72rem;',
    'letter-spacing:0.12em;text-transform:uppercase;padding:7px 16px;',
    'border-radius:6px;cursor:pointer;transition:all 0.2s;border:1px solid;}',
    '#tut-prev{background:rgba(212,175,55,0.08);color:rgba(212,175,55,0.6);',
    'border-color:rgba(212,175,55,0.2);}',
    '#tut-prev:hover{background:rgba(212,175,55,0.15);color:#D4AF37;}',
    '#tut-prev:disabled{opacity:0.3;cursor:default;}',
    '#tut-next{background:linear-gradient(135deg,#D4AF37,#b8952e);color:#0a0710;',
    'border-color:transparent;font-weight:700;}',
    '#tut-next:hover{filter:brightness(1.1);}',
  ].join('');
  document.head.appendChild(style);

  // ── Owl SVG generator ─────────────────────────────────────────────────────
  function owlSVG(color) {
    color = color || '#D4AF37';
    return [
      '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" fill="none">',
      // body
      '<ellipse cx="40" cy="50" rx="22" ry="24" fill="' + color + '" opacity="0.15"/>',
      // ear tufts
      '<polygon points="24,18 20,6 28,14" fill="' + color + '" opacity="0.85"/>',
      '<polygon points="56,18 52,14 60,6" fill="' + color + '" opacity="0.85"/>',
      // head
      '<ellipse cx="40" cy="30" rx="21" ry="19" fill="' + color + '" opacity="0.18"/>',
      // eyes
      '<circle cx="28" cy="29" r="9" fill="' + color + '" opacity="0.9"/>',
      '<circle cx="52" cy="29" r="9" fill="' + color + '" opacity="0.9"/>',
      '<circle cx="28" cy="29" r="5" fill="#0a0710"/>',
      '<circle cx="52" cy="29" r="5" fill="#0a0710"/>',
      '<circle cx="29.5" cy="27.5" r="2" fill="rgba(255,255,255,0.7)"/>',
      '<circle cx="53.5" cy="27.5" r="2" fill="rgba(255,255,255,0.7)"/>',
      // beak
      '<polygon points="40,34 35,42 45,42" fill="' + color + '" opacity="0.95"/>',
      '</svg>',
    ].join('');
  }

  // ── Build DOM ─────────────────────────────────────────────────────────────
  var trigger = document.createElement('button');
  trigger.id = 'tut-trigger';
  trigger.title = 'Open Guide';
  trigger.textContent = '?';
  document.body.appendChild(trigger);

  var backdrop = document.createElement('div');
  backdrop.id = 'tut-backdrop';
  backdrop.innerHTML = [
    '<div id="tut-card">',
    '  <div id="tut-header">',
    '    <div id="tut-owl-icon">' + owlSVG(cfg.familiar) + '</div>',
    '    <span id="tut-title-text">' + escHtml(cfg.title) + '</span>',
    '    <span id="tut-step-label">Step 1 / ' + cfg.slides.length + '</span>',
    '    <button id="tut-close" title="Close">✕</button>',
    '  </div>',
    '  <div id="tut-body">',
    '    <div id="tut-avatar">' + owlSVG(cfg.familiar) + '</div>',
    '    <div id="tut-content">',
    '      <p id="tut-slide-heading"></p>',
    '      <p id="tut-slide-body"></p>',
    '      <pre id="tut-highlight" style="display:none"></pre>',
    '    </div>',
    '  </div>',
    '  <div id="tut-footer">',
    '    <div id="tut-dots"></div>',
    '    <button id="tut-prev" class="tut-btn">← Prev</button>',
    '    <button id="tut-next" class="tut-btn">Next →</button>',
    '  </div>',
    '</div>',
  ].join('');
  document.body.appendChild(backdrop);

  // ── State ─────────────────────────────────────────────────────────────────
  var storageKey = 'tut_idx_' + (document.title || 'page');
  var idx = 0;
  try { idx = Math.min(parseInt(sessionStorage.getItem(storageKey) || '0', 10), cfg.slides.length - 1); } catch (e) {}
  if (isNaN(idx) || idx < 0) idx = 0;

  // ── References ────────────────────────────────────────────────────────────
  var elStep    = document.getElementById('tut-step-label');
  var elHeading = document.getElementById('tut-slide-heading');
  var elBody    = document.getElementById('tut-slide-body');
  var elHlight  = document.getElementById('tut-highlight');
  var elDots    = document.getElementById('tut-dots');
  var btnPrev   = document.getElementById('tut-prev');
  var btnNext   = document.getElementById('tut-next');

  // ── Build dots ────────────────────────────────────────────────────────────
  cfg.slides.forEach(function (_, i) {
    var dot = document.createElement('span');
    dot.className = 'tut-dot' + (i === idx ? ' active' : '');
    dot.addEventListener('click', function () { goto(i); });
    elDots.appendChild(dot);
  });

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    var s = cfg.slides[idx];
    elStep.textContent = 'Step ' + (idx + 1) + ' / ' + cfg.slides.length;
    elHeading.textContent = s.heading || '';
    elBody.textContent = s.body || '';
    if (s.highlight) {
      elHlight.textContent = s.highlight;
      elHlight.style.display = 'block';
    } else {
      elHlight.style.display = 'none';
    }
    btnPrev.disabled = idx === 0;
    btnNext.textContent = idx === cfg.slides.length - 1 ? 'Close ✕' : 'Next →';
    var dots = elDots.querySelectorAll('.tut-dot');
    dots.forEach(function (d, i) {
      d.classList.toggle('active', i === idx);
    });
    try { sessionStorage.setItem(storageKey, String(idx)); } catch (e) {}
  }

  function goto(n) {
    idx = Math.max(0, Math.min(cfg.slides.length - 1, n));
    render();
  }

  function open() {
    backdrop.classList.add('open');
    render();
  }

  function close() {
    backdrop.classList.remove('open');
  }

  // ── Events ────────────────────────────────────────────────────────────────
  trigger.addEventListener('click', open);
  document.getElementById('tut-close').addEventListener('click', close);
  backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

  btnPrev.addEventListener('click', function () { goto(idx - 1); });
  btnNext.addEventListener('click', function () {
    if (idx === cfg.slides.length - 1) { close(); } else { goto(idx + 1); }
  });

  document.addEventListener('keydown', function (e) {
    if (!backdrop.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') goto(idx - 1);
    if (e.key === 'ArrowRight') goto(idx + 1);
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  render();
}());
