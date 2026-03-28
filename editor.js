// ============================================================
// HTMLCSSJSEditor — editor.js
// 100% Static — No backend, no server, just the browser
// https://htmleditor.analyticsdrive.tech
// ============================================================

'use strict';

// ── State ──────────────────────────────────────────────────
let currentTab  = 'html';
let fontSize    = 14;
let isDark      = true;
let isStacked   = false;
let updateTimer = null;
let saveTimer   = null;
let editors     = {};

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initEditors();
  loadFromStorage();   // also checks URL share
  setupResizer();
  setupKeyboardShortcuts();
  updatePreview();
  showToast('⚡ HTMLCSSJSEditor ready!', 'success');

  // Close dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.templates-dropdown'))
      document.getElementById('templates-menu').classList.remove('open');
  });
});

// ── Editor Init ────────────────────────────────────────────
function initEditors() {
  const base = {
    lineNumbers:      true,
    autoCloseBrackets:true,
    autoCloseTags:    true,
    matchBrackets:    true,
    foldGutter:       true,
    gutters:          ['CodeMirror-linenumbers','CodeMirror-foldgutter'],
    indentUnit:       2,
    tabSize:          2,
    lineWrapping:     false,
    extraKeys: {
      'Ctrl-Enter': runCode,
      'Ctrl-S':     downloadCode,
      'Ctrl-/':     cm => cm.execCommand('toggleComment'),
    }
  };

  editors.html = CodeMirror.fromTextArea(document.getElementById('editor-html'), { ...base, mode:'htmlmixed' });
  editors.css  = CodeMirror.fromTextArea(document.getElementById('editor-css'),  { ...base, mode:'css' });
  editors.js   = CodeMirror.fromTextArea(document.getElementById('editor-js'),   { ...base, mode:'javascript' });

  // Fix accessibility: label the hidden CodeMirror textarea inputs for screen readers
  editors.html.getInputField().setAttribute('aria-label', 'HTML code editor');
  editors.css.getInputField().setAttribute('aria-label',  'CSS code editor');
  editors.js.getInputField().setAttribute('aria-label',   'JavaScript code editor');

  setFontSize(fontSize, true);

  Object.values(editors).forEach(ed => {
    ed.on('change',         () => { scheduleUpdate(); scheduleAutoSave(); updateChars(); });
    ed.on('cursorActivity', updateCursorPos);
  });
}

// ── Tab Switching ──────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.editor-wrapper').forEach(w => w.classList.add('hidden'));
  document.getElementById('editor-' + tab + '-wrapper').classList.remove('hidden');
  const labels = { html:'HTML', css:'CSS', js:'JavaScript' };
  document.getElementById('panel-title').textContent = labels[tab];
  setTimeout(() => { editors[tab].refresh(); editors[tab].focus(); }, 10);
}

// ── Preview ────────────────────────────────────────────────
function scheduleUpdate() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(updatePreview, 420);
}

function updatePreview() {
  const h = editors.html.getValue();
  const c = editors.css.getValue();
  const j = editors.js.getValue();

  const doc = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>${c}</style></head><body>
${h}
<script>${j}<\/script></body></html>`;

  const iframe = document.getElementById('preview');
  iframe.srcdoc = doc;

  // Flash effect
  const wrapper = document.getElementById('preview-wrapper');
  wrapper.classList.remove('flash');
  void wrapper.offsetWidth;
  wrapper.classList.add('flash');
}

function runCode() {
  updatePreview();
  showToast('🚀 Running code...', 'success');

  // Mobile UX: Automatically switch to full-screen preview when "Run" is clicked
  if (window.innerWidth <= 720) {
    toggleMobileView(true);
  }
}

function toggleMobileView(showPreview) {
  const main = document.getElementById('main');
  if (showPreview) {
    main.classList.add('show-preview-mobile');
  } else {
    main.classList.remove('show-preview-mobile');
  }
  // Refresh editors to fix any CodeMirror layout issues after view swap
  Object.values(editors).forEach(ed => ed.refresh());
}

// ── Auto-Save ──────────────────────────────────────────────
function scheduleAutoSave() {
  clearTimeout(saveTimer);
  setStatus('save', '⏳ Saving…');
  saveTimer = setTimeout(saveToStorage, 1200);
}

function saveToStorage() {
  const data = {
    html:      editors.html.getValue(),
    css:       editors.css.getValue(),
    js:        editors.js.getValue(),
    theme:     isDark ? 'dark' : 'light',
    fontSize:  fontSize,
    ts:        Date.now()
  };
  try {
    localStorage.setItem('codeforge_v1', JSON.stringify(data));
    setStatus('save', '✅ Auto-saved');
  } catch(e) {
    setStatus('save', '⚠ Storage full');
  }
}

function loadFromStorage() {
  // URL share has priority
  if (loadFromURL()) return;

  const raw = localStorage.getItem('codeforge_v1');
  if (!raw) { loadTemplate('helloWorld'); return; }
  try {
    const d = JSON.parse(raw);
    editors.html.setValue(d.html || '');
    editors.css.setValue(d.css  || '');
    editors.js.setValue(d.js   || '');
    if (d.fontSize) { fontSize = d.fontSize; setFontSize(fontSize, true); }
    if (d.theme === 'light') setTheme(false);
  } catch(e) { loadTemplate('helloWorld'); }
}

// ── Download ───────────────────────────────────────────────
function downloadCode() {
  const h = editors.html.getValue();
  const c = editors.css.getValue();
  const j = editors.js.getValue();

  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Project</title>
  <style>
${c}
  </style>
</head>
<body>
${h}
<script>
${j}
<\/script>
</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'project.html'; a.click();
  URL.revokeObjectURL(url);
  showToast('📁 Saved as project.html', 'success');
  saveToStorage();
}

// ── Open File ──────────────────────────────────────────────
function openFile() { document.getElementById('file-input').click(); }

function handleFileOpen(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const src = e.target.result;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'html' || ext === 'htm') {
      // Collect ALL style blocks and ALL inline script blocks
      const styleMatches  = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
      const scriptMatches = [...src.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi)];
      const allCSS = styleMatches.map(m => m[1]).join('\n').trim();
      const allJS  = scriptMatches.map(m => m[1]).join('\n').trim();
      let cleaned = src
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      const bodyM = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      editors.html.setValue(bodyM ? bodyM[1].trim() : cleaned.trim());
      editors.css.setValue(allCSS);
      editors.js.setValue(allJS);
    } else if (ext === 'css') {
      editors.css.setValue(src); switchTab('css');
    } else if (ext === 'js') {
      editors.js.setValue(src); switchTab('js');
    }
    updatePreview();
    showToast('📂 Opened: ' + file.name, 'success');
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ── Share via URL ──────────────────────────────────────────
function shareCode() {
  const data  = { h: editors.html.getValue(), c: editors.css.getValue(), j: editors.js.getValue() };
  let encoded;
  try {
    encoded = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch(e) {
    showToast('❌ Encoding error', 'error'); return;
  }
  if (encoded.length > 60000) {
    showToast('⚠ Code too large for URL sharing', 'error'); return;
  }
  const url = location.origin + location.pathname + '#code=' + encoded;
  history.replaceState(null, '', '#code=' + encoded);

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Share link copied!', 'success'));
  } else {
    prompt('Copy this share link:', url);
  }
}

function loadFromURL() {
  const hash = location.hash;
  if (!hash.startsWith('#code=')) return false;
  try {
    const json = decodeURIComponent(escape(atob(hash.slice(6))));
    const d    = JSON.parse(json);
    editors.html.setValue(d.h || '');
    editors.css.setValue(d.c  || '');
    editors.js.setValue(d.j   || '');
    showToast('🔗 Shared code loaded!', 'info');
    return true;
  } catch(e) {
    showToast('❌ Invalid share link', 'error');
    return false;
  }
}

// ── Templates ──────────────────────────────────────────────
function toggleTemplates() {
  document.getElementById('templates-menu').classList.toggle('open');
}

function clearEditor() {
  if (!confirm('Clear all code?')) return;
  editors.html.setValue(''); editors.css.setValue(''); editors.js.setValue('');
  updatePreview(); showToast('🗑 Editor cleared', 'info');
}

function loadTemplate(name) {
  document.getElementById('templates-menu').classList.remove('open');
  const t = TEMPLATES[name];
  if (!t) return;
  editors.html.setValue(t.html);
  editors.css.setValue(t.css);
  editors.js.setValue(t.js);
  switchTab('html');
  updatePreview();
  showToast('📋 Template loaded: ' + name, 'info');
}

const TEMPLATES = {
  blank: { html: '', css: '', js: '' },

  helloWorld: {
    html: `<div class="container">
  <div class="card">
    <div class="icon">⚡</div>
    <h1>HTMLCSSJSEditor: Online HTML Compiler</h1>
    <p>Welcome to <strong>HTMLCSSJSEditor</strong>. Your free <strong>online HTML, CSS and JavaScript compiler</strong>. Start building your web projects instantly — no sign-up required!</p>
    <button onclick="greet()">Learn More ⚡</button>
  </div>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);
  font-family:'Segoe UI',sans-serif}
.card{background:rgba(255,255,255,.06);backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:52px;
  text-align:center;max-width:440px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
.icon{font-size:56px;margin-bottom:20px}
h1{font-size:38px;font-weight:700;color:#fff;margin-bottom:14px}
p{color:rgba(255,255,255,.65);line-height:1.65;margin-bottom:30px;font-size:16px}
strong{color:#00d4ff}
button{padding:13px 36px;background:linear-gradient(135deg,#00d4ff,#7c3aed);
  border:none;border-radius:50px;color:#fff;font-size:16px;font-weight:600;
  cursor:pointer;transition:.2s}
button:hover{transform:translateY(-3px);box-shadow:0 10px 30px rgba(0,212,255,.4)}`,
    js: `function greet(){
  const msgs=['Hello! 👋','Start building! 🚀','You got this! 💪','HTMLCSSJSEditor ⚡'];
  const msg = msgs[Math.floor(Math.random()*msgs.length)];
  let t = document.getElementById('_t');
  if(!t){
    t = document.createElement('div'); t.id='_t';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);'
      +'background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff;padding:12px 28px;'
      +'border-radius:50px;font-weight:700;font-size:15px;z-index:9999;'
      +'box-shadow:0 8px 24px rgba(0,212,255,.4);transition:opacity .4s';
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(t._x); t._x=setTimeout(()=>t.style.opacity='0',2000);
}`
  },

  card: {
    html: `<div class="page">
  <div class="card">
    <div class="card-img">⚡</div>
    <div class="card-body">
      <span class="badge">Online HTML Compiler</span>
      <h2>HTMLCSSJSEditor</h2>
      <p>The best <strong>online HTML CSS JS compiler</strong> for developers. Build, test and showcase your web prototypes in seconds.</p>
      <div class="card-foot">
        <span class="price">FREE</span>
        <button>Start Coding →</button>
      </div>
    </div>
  </div>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#f0f4f8;font-family:'Segoe UI',sans-serif}
.card{width:320px;border-radius:20px;overflow:hidden;background:#fff;
  box-shadow:0 20px 60px rgba(0,0,0,.12);transition:.3s}
.card:hover{transform:translateY(-8px);box-shadow:0 32px 80px rgba(0,0,0,.18)}
.card-img{height:180px;background:linear-gradient(135deg,#667eea,#764ba2);
  display:flex;align-items:center;justify-content:center;font-size:72px}
.card-body{padding:24px}
.badge{background:#ede9fe;color:#7c3aed;padding:4px 12px;border-radius:50px;
  font-size:11px;font-weight:600;letter-spacing:.5px}
h2{font-size:22px;font-weight:700;color:#1a1a1a;margin:12px 0 8px}
p{color:#666;font-size:14px;line-height:1.6;margin-bottom:18px}
.card-foot{display:flex;align-items:center;justify-content:space-between}
.price{font-size:24px;font-weight:700;color:#1a1a1a}
button{padding:10px 22px;background:linear-gradient(135deg,#667eea,#764ba2);
  border:none;border-radius:50px;color:#fff;font-weight:600;cursor:pointer;transition:.2s}
button:hover{transform:scale(1.05)}`,
    js: ''
  },
  navbar: {
    html: `<nav class="navbar">
  <div class="nav-brand">🚀 HTMLCSSJSEditor</div>
  <div class="nav-links" id="navLinks">
    <a href="#">Home</a><a href="#">About</a><a href="#">Services</a><a href="#">Contact</a>
  </div>
  <button class="hamburger" onclick="toggleMenu()" id="hamburger">☰</button>
</nav>
<div class="hero">
  <h1>Welcome to HTMLCSSJSEditor</h1>
  <p>A powerful <strong>online HTML editor</strong> and compiler. Build, test and share your web projects instantly. Resize the preview to see the responsive layout adapt.</p>
  <button class="cta" onclick="toggleMenu()">Get Started →</button>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0f172a}
.navbar{display:flex;align-items:center;padding:14px 32px;
  background:rgba(255,255,255,.05);backdrop-filter:blur(12px);
  border-bottom:1px solid rgba(255,255,255,.08);position:sticky;top:0;z-index:10}
.nav-brand{font-size:22px;font-weight:700;color:#fff;flex:1}
.nav-links a{color:rgba(255,255,255,.7);text-decoration:none;margin-left:28px;
  font-size:14px;font-weight:500;transition:.2s}
.nav-links a:hover{color:#00d4ff}
.hamburger{display:none;background:none;border:none;color:#fff;font-size:22px;cursor:pointer}
.hero{min-height:90vh;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;padding:40px;
  background:linear-gradient(135deg,#0f172a,#1e1b4b)}
h1{font-size:52px;font-weight:800;color:#fff;margin-bottom:18px}
p{color:rgba(255,255,255,.6);font-size:18px;max-width:500px;line-height:1.6;margin-bottom:32px}
.cta{padding:14px 40px;background:linear-gradient(135deg,#00d4ff,#7c3aed);
  border:none;border-radius:50px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;transition:.2s}
.cta:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,212,255,.4)}
@media(max-width:600px){
  .nav-links{display:none;flex-direction:column;position:absolute;
    top:52px;left:0;right:0;background:#1e1b4b;padding:16px 32px}
  .nav-links.open{display:flex}
  .nav-links a{margin:8px 0}
  .hamburger{display:block}
  h1{font-size:32px}
}`,
    js: `function toggleMenu(){
  document.getElementById('navLinks').classList.toggle('open');
  document.getElementById('hamburger').textContent =
    document.getElementById('navLinks').classList.contains('open') ? '✕' : '☰';
}`
  },

  animation: {
    html: `<div class="scene">
  <div class="orb orb1"></div>
  <div class="orb orb2"></div>
  <div class="orb orb3"></div>
  <div class="text">
    <h1>CSS Motion</h1>
    <p>Pure CSS animations — no JavaScript needed.</p>
  </div>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;overflow:hidden;background:#030712;
  display:flex;align-items:center;justify-content:center}
.scene{position:relative;width:400px;height:400px;display:flex;
  align-items:center;justify-content:center}
.orb{position:absolute;border-radius:50%;filter:blur(60px);opacity:.7;animation:float 6s ease-in-out infinite}
.orb1{width:220px;height:220px;background:#7c3aed;animation-delay:0s;top:0;left:0}
.orb2{width:180px;height:180px;background:#00d4ff;animation-delay:-2s;bottom:0;right:0}
.orb3{width:150px;height:150px;background:#f97316;animation-delay:-4s;bottom:0;left:40px}
@keyframes float{
  0%,100%{transform:translate(0,0) scale(1)}
  33%{transform:translate(20px,-20px) scale(1.1)}
  66%{transform:translate(-10px,15px) scale(.95)}
}
.text{position:relative;z-index:2;text-align:center}
h1{font-size:48px;font-weight:800;color:#fff;
  background:linear-gradient(135deg,#00d4ff,#7c3aed,#f97316);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:shimmer 3s linear infinite;background-size:200%}
@keyframes shimmer{0%{background-position:0%}100%{background-position:200%}}
p{color:rgba(255,255,255,.5);margin-top:10px;font-size:15px;font-family:'Segoe UI',sans-serif}`,
    js: ''
  },

  form: {
    html: `<div class="page">
  <form class="form" onsubmit="handleSubmit(event)">
    <div class="form-header">
      <h2>HTMLCSSJSEditor</h2>
      <p>The best <strong>online HTML editor</strong> for mobile and web development.</p>
    </div>
    <div class="field"><label>Full Name</label><input type="text" placeholder="John Doe" required /></div>
    <div class="field"><label>Email</label><input type="email" placeholder="john@example.com" required /></div>
    <div class="field"><label>Password</label><input type="password" placeholder="Min 8 characters" required /></div>
    <button type="submit" class="submit-btn">Create Account →</button>
    <p class="login-link">Already have an account? <a href="#">Sign in</a></p>
  </form>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#1e1b4b,#0f172a);font-family:'Segoe UI',sans-serif}
.form{background:rgba(255,255,255,.05);backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:40px;
  width:360px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
.form-header{text-align:center;margin-bottom:28px}
h2{color:#fff;font-size:26px;font-weight:700;margin-bottom:6px}
.form-header p{color:rgba(255,255,255,.5);font-size:14px}
.field{margin-bottom:18px}
label{display:block;color:rgba(255,255,255,.7);font-size:13px;font-weight:500;margin-bottom:7px}
input{width:100%;padding:12px 16px;background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.1);border-radius:10px;
  color:#fff;font-size:14px;outline:none;transition:.2s;font-family:'Segoe UI',sans-serif}
input:focus{border-color:#00d4ff;box-shadow:0 0 0 3px rgba(0,212,255,.15)}
input::placeholder{color:rgba(255,255,255,.3)}
.submit-btn{width:100%;padding:14px;background:linear-gradient(135deg,#00d4ff,#7c3aed);
  border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:600;
  cursor:pointer;margin-top:6px;transition:.2s}
.submit-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,212,255,.35)}
.login-link{text-align:center;color:rgba(255,255,255,.4);font-size:13px;margin-top:18px}
.login-link a{color:#00d4ff;text-decoration:none}`,
    js: `function handleSubmit(e){
  e.preventDefault();
  const btn = e.target.querySelector('.submit-btn');
  btn.textContent = '✅ Account created!';
  btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
  setTimeout(()=>{
    btn.textContent = 'Create Account →';
    btn.style.background = '';
    e.target.reset();
  }, 2500);
}`
  },

  grid: {
    html: `<div class="page">
  <header><h1>HTMLCSSJSEditor: Online CSS Grid Layout</h1></header>
  <div class="grid">
    <div class="card featured">🌟 Featured<br><small>Spans 2 columns</small></div>
    <div class="card">📦 Item 2</div>
    <div class="card">🎯 Item 3</div>
    <div class="card">🚀 Item 4</div>
    <div class="card">💡 Item 5</div>
    <div class="card tall">📊 Tall Item<br><small>Spans 2 rows</small></div>
    <div class="card">🎨 Item 7</div>
    <div class="card">🔥 Item 8</div>
  </div>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#fff;padding:24px}
header{text-align:center;padding:24px 0 32px}
h1{font-size:32px;font-weight:700;background:linear-gradient(135deg,#00d4ff,#7c3aed);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:16px;padding:28px;font-size:22px;font-weight:600;
  transition:.25s;cursor:default}
.card:hover{background:rgba(255,255,255,.1);transform:translateY(-4px);
  border-color:rgba(0,212,255,.4)}
small{font-size:13px;font-weight:400;color:rgba(255,255,255,.5);display:block;margin-top:6px}
.featured{grid-column:span 2;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(124,58,237,.15));
  border-color:rgba(0,212,255,.3)}
.tall{grid-row:span 2;display:flex;flex-direction:column;justify-content:center;
  background:linear-gradient(135deg,rgba(249,115,22,.15),rgba(124,58,237,.15));
  border-color:rgba(249,115,22,.3)}
@media(max-width:500px){.grid{grid-template-columns:1fr}.featured,.tall{grid-column:auto;grid-row:auto}}`,
    js: ''
  },

  glassmorphism: {
    html: `<div class="bg">
  <div class="blob b1"></div>
  <div class="blob b2"></div>
  <div class="blob b3"></div>
  <div class="glass-card">
    <div class="avatar">💎</div>
    <h2>Glassmorphism</h2>
    <p>The frosted-glass effect using <code>backdrop-filter</code>. Works beautifully over colorful backgrounds.</p>
    <div class="tags">
      <span>CSS</span><span>Design</span><span>Modern</span>
    </div>
    <button>Explore →</button>
  </div>
</div>`,
    css: `*{box-sizing:border-box;margin:0;padding:0}
body{min-height:100vh;display:flex;align-items:center;justify-content:center;
  overflow:hidden;font-family:'Segoe UI',sans-serif}
.bg{min-height:100vh;width:100%;background:#030712;display:flex;
  align-items:center;justify-content:center;position:relative;overflow:hidden}
.blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.6}
.b1{width:400px;height:400px;background:#7c3aed;top:-80px;left:-80px;animation:drift 8s ease-in-out infinite}
.b2{width:350px;height:350px;background:#00d4ff;bottom:-60px;right:-60px;animation:drift 10s ease-in-out infinite reverse}
.b3{width:250px;height:250px;background:#f97316;bottom:10%;left:30%;animation:drift 12s ease-in-out infinite 2s}
@keyframes drift{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-30px)}}
.glass-card{position:relative;z-index:2;background:rgba(255,255,255,.07);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  border:1px solid rgba(255,255,255,.15);border-radius:24px;
  padding:48px;max-width:380px;text-align:center;
  box-shadow:0 32px 80px rgba(0,0,0,.4)}
.avatar{font-size:52px;margin-bottom:18px}
h2{color:#fff;font-size:28px;font-weight:700;margin-bottom:12px}
p{color:rgba(255,255,255,.6);line-height:1.65;font-size:15px;margin-bottom:22px}
code{color:#00d4ff;background:rgba(0,212,255,.1);padding:1px 6px;border-radius:4px;font-size:13px}
.tags{display:flex;gap:8px;justify-content:center;margin-bottom:28px;flex-wrap:wrap}
.tags span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);
  padding:4px 14px;border-radius:50px;color:rgba(255,255,255,.7);font-size:12px;font-weight:500}
button{padding:12px 32px;background:linear-gradient(135deg,#00d4ff,#7c3aed);
  border:none;border-radius:50px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:.2s}
button:hover{transform:translateY(-3px);box-shadow:0 12px 30px rgba(0,212,255,.4)}`,
    js: ''
  }
};

// ── Theme ──────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('codeforge_theme');
  if (saved === 'light') setTheme(false);
  else setTheme(true);
}

function toggleTheme() { setTheme(!isDark); }

function setTheme(dark) {
  isDark = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  document.getElementById('btn-theme').textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('codeforge_theme', dark ? 'dark' : 'light');
}

// ── Font Size ──────────────────────────────────────────────
function changeFontSize(delta) {
  fontSize = Math.min(24, Math.max(10, fontSize + delta));
  setFontSize(fontSize);
}

function setFontSize(size, silent) {
  fontSize = size;
  Object.values(editors).forEach(ed => {
    ed.getWrapperElement().style.fontSize = size + 'px';
    ed.refresh();
  });
  document.getElementById('font-size-display').textContent = size + 'px';
  if (!silent) saveToStorage();
}

// ── Layout ─────────────────────────────────────────────────
function toggleLayout() {
  isStacked = !isStacked;
  document.getElementById('main').classList.toggle('stacked', isStacked);
  const resizer = document.getElementById('resizer');
  // reset flex
  document.getElementById('editor-panel').style.flex = '';
  document.getElementById('preview-panel').style.flex = '';
  document.getElementById('layout-btn').textContent = isStacked ? '↕ Stack' : '⇄ Split';
  setTimeout(() => Object.values(editors).forEach(e => e.refresh()), 50);
}

// ── Device Preview ─────────────────────────────────────────
function setDevice(device) {
  const wrapper = document.getElementById('preview-wrapper');
  wrapper.className = 'preview-wrapper';
  if (device !== 'desktop') wrapper.classList.add('device-' + device);
  document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('dev-' + device).classList.add('active');
}

// ── Fullscreen Preview ─────────────────────────────────────
function fullscreenPreview() {
  const el = document.getElementById('preview-wrapper');
  if (el.requestFullscreen) el.requestFullscreen();
}

// ── Resizer (drag to resize panels) ───────────────────────
function setupResizer() {
  const resizer      = document.getElementById('resizer');
  const editorPanel  = document.getElementById('editor-panel');
  const previewPanel = document.getElementById('preview-panel');
  const main         = document.getElementById('main');
  let dragging = false, startX = 0, startY = 0, startEdW = 0, startEdH = 0;

  function startDrag(e) {
    dragging = true; resizer.classList.add('dragging');
    startX = e.clientX; startY = e.clientY;
    startEdW = editorPanel.offsetWidth; startEdH = editorPanel.offsetHeight;
    document.body.style.cursor = isStacked ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  }

  function onDrag(e) {
    if (!dragging) return;
    if (!isStacked) {
      const dx  = e.clientX - startX;
      const tot = main.offsetWidth;
      const nw  = Math.min(Math.max(startEdW + dx, 150), tot - 150);
      editorPanel.style.flex  = 'none';
      editorPanel.style.width = nw + 'px';
      previewPanel.style.flex = '1';
    } else {
      const dy  = e.clientY - startY;
      const tot = main.offsetHeight;
      const nh  = Math.min(Math.max(startEdH + dy, 80), tot - 80);
      editorPanel.style.flex   = 'none';
      editorPanel.style.height = nh + 'px';
      previewPanel.style.flex  = '1';
    }
    Object.values(editors).forEach(ed => ed.refresh());
  }

  function stopDrag() {
    if (!dragging) return;
    dragging = false; resizer.classList.remove('dragging');
    document.body.style.cursor = ''; document.body.style.userSelect = '';
  }

  // Mouse events
  resizer.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);

  // Touch events (mobile/tablet support)
  resizer.addEventListener('touchstart', e => { e.preventDefault(); startDrag(e.touches[0]); }, { passive: false });
  document.addEventListener('touchmove',  e => { if (dragging) { e.preventDefault(); onDrag(e.touches[0]); } }, { passive: false });
  document.addEventListener('touchend',   stopDrag);
}

// ── Keyboard Shortcuts ─────────────────────────────────────
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's')     { e.preventDefault(); downloadCode(); }
  });
}

// ── Status Bar ─────────────────────────────────────────────
function updateChars() {
  const total = Object.values(editors).reduce((s, ed) => s + ed.getValue().length, 0);
  setStatus('chars', total.toLocaleString() + ' chars');
}

function updateCursorPos() {
  const ed     = editors[currentTab];
  const cursor = ed.getCursor();
  setStatus('line', `Ln ${cursor.line + 1}, Col ${cursor.ch + 1}`);
}

function setStatus(id, text) {
  const el = document.getElementById('status-' + id);
  if (el) el.textContent = text;
}

// ── Toast ──────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  clearTimeout(toastTimer);
  t.textContent  = msg;
  t.className    = 'toast ' + type;
  void t.offsetWidth;
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
