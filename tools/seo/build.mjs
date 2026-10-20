#!/usr/bin/env node
// Static revision pages for search engines: /revision/ with a page for every level, subject, exam board and topic,
// plus sitemap.xml and robots.txt. Everything comes from the content block in index.html, which holds only the free
// content the app shows everyone (the first subtopic of each topic), so premium notes and questions never get here.
// Run from anywhere: node tools/seo/build.mjs   (the "Revision pages" workflow runs it whenever index.html changes)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const SITE = 'https://fullmarkss.com';
const DIR = 'revision';
const TODAY = new Date().toISOString().slice(0, 10);

const LEVEL = {
  GCSE: { slug: 'gcse', name: 'GCSE', years: 'Years 10 and 11', course: s => `GCSE ${s}` },
  AS: { slug: 'a-level-year-12', name: 'A-level Year 12', years: 'First year of A-level (AS)', course: s => `A-level ${s} Year 12` },
  A2: { slug: 'a-level-year-13', name: 'A-level Year 13', years: 'Second year of A-level (A2)', course: s => `A-level ${s} Year 13` },
};
const BOARD = { aqa: ['aqa', 'AQA'], ocr: ['ocr', 'OCR'], ocrb: ['ocr-b', 'OCR B'], edexcel: ['edexcel', 'Edexcel'], cie: ['cambridge', 'Cambridge'] };

// ---------- content (the same data and board logic as the app)
function load() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = html.indexOf('/* CONTENT:START'), b = html.indexOf('/* CONTENT:END */');
  if (a < 0 || b < a) throw new Error('index.html: the CONTENT:START … CONTENT:END block is missing');
  let code = html.slice(html.indexOf('\n', a) + 1, b);
  // OCR B shares OCR A's notes: the app adds its specifications right after the content block
  const o = html.indexOf('\nconst OCRB='), e = o < 0 ? -1 : html.indexOf('SPECS[k].ocrb=', o);
  if (e > 0) code += html.slice(o, html.indexOf('\n', e) + 1);
  else console.warn('OCR B specifications not found in index.html, so there are no OCR B pages');
  const col = html.match(/\nconst SUBJ_COL=(\{[^\n]*?\});/);
  if (col) code += `\nconst SUBJ_COL=${col[1]};`;
  const C = vm.runInNewContext(code + '\n;({LEVELS,BOARDS,SPECS,SUBJECTS,SUBJ_COL:typeof SUBJ_COL==="undefined"?{}:SUBJ_COL})', {}, { timeout: 30000 });
  if (Object.values(C.SPECS).some(s => s.ocrb) && !C.BOARDS.some(x => x[0] === 'ocrb')) C.BOARDS.splice(2, 0, ['ocrb', 'OCR B']);
  return C;
}
const C = load();
// The backend the app talks to, for counting visits to these pages (stats.js in the backend).
const API = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/const API_BASE = "([^"]*)"/) || [])[1] || '';
const contentBoard = b => b === 'ocrb' ? 'ocr' : b;
// a level's topics in one board's own order (the app's ldFor)
function ldFor(raw, b) {
  if (!raw || !raw.full) return raw;
  const vb = raw.views && (raw.views[b] ? b : raw.views[contentBoard(b)] ? contentBoard(b) : null);
  if (vb) {
    const by = new Map(raw.topics.flatMap(t => t.subs.map(x => [x.n, x])));
    return { ...raw, topics: raw.views[vb].map(vt => ({ n: vt.n, title: vt.title, i: vt.i, subs: vt.s.map((sn, k) => by.has(sn) ? { ...by.get(sn), key: sn, n: vt.n + '.' + (k + 1) } : null).filter(Boolean) })).filter(t => t.subs.length) };
  }
  return { ...raw, topics: raw.topics.map(t => ({ ...t, subs: t.subs.filter(s => !s.b || s.b.includes(contentBoard(b))) })).filter(t => t.subs.length) };
}
const nq = x => x.nq ?? (x.q.length + (x.ng || 0));
const isFree = x => Array.isArray(x.notes) && x.notes.length > 0;
const keyOf = x => x.key || x.n;

// ---------- text helpers
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const plain = s => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
const fmt = n => n.toLocaleString('en-GB');
const plural = (n, one, many = one + 's') => `${fmt(n)} ${n === 1 ? one : many}`;
const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const anchor = k => 's-' + slug(k);
const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
function clip(s, n = 158) {
  s = plain(s);
  if (s.length <= n) return s;
  const c = s.slice(0, n - 1);
  return c.slice(0, c.lastIndexOf(' ')).replace(/[\s,;:.–-]+$/, '') + '…';
}
const json = x => JSON.stringify(x).replace(/</g, '\\u003c');
const fit = (...titles) => titles.find(t => t.length <= 75) || titles[titles.length - 1];
const appLink = (k, L, ...rest) => '/#study/' + [k, L, ...rest].map(encodeURIComponent).join('/');

// a diagram is written as its own .svg file only if it is a plain drawing
function safeSvg(d) {
  if (typeof d !== 'string' || !/^\s*<svg[\s>]/i.test(d) || !/<\/svg>\s*$/i.test(d)) return null;
  if (/<script|<foreignObject|javascript:|\son[a-z]+\s*=|<iframe|<object|<embed|@import/i.test(d)) return null;
  if (/href\s*=\s*["'](?!#)/i.test(d) || /url\(\s*["']?(?!#)/i.test(d)) return null;
  const svg = /xmlns\s*=/.test(d.slice(0, 300)) ? d.trim() : d.trim().replace(/^<svg/i, "<svg xmlns='http://www.w3.org/2000/svg'");
  const vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  return { svg, w: vb ? Math.round(+vb[1]) : 450, h: vb ? Math.round(+vb[2]) : 300 };
}

// ---------- the model: courses (a subject at a level), their boards and topics
const courses = [];
for (const [k, s] of Object.entries(C.SUBJECTS)) for (const [L] of C.LEVELS) {
  const raw = s[L];
  if (!raw || !raw.full || !LEVEL[L] || !raw.topics.length) continue;
  const lv = LEVEL[L], url = `/${DIR}/${lv.slug}/${slug(s.name)}/`;
  const boards = C.BOARDS.map(([b]) => b).filter(b => BOARD[b] && C.SPECS[k] && C.SPECS[k][b] && C.SPECS[k][b][L]).map(b => {
    const [spec, note] = C.SPECS[k][b][L][0].split(' · ');
    const label = b === 'ocr' && C.SPECS[k].ocrb && Object.values(C.SPECS[k].ocrb).some(Boolean) ? 'OCR A' : BOARD[b][1];
    return { b, label, spec, note: note || '', url: url + BOARD[b][0] + '/', topics: ldFor(raw, b).topics };
  });
  const taken = new Set(boards.map(x => BOARD[x.b][0]));
  const topics = raw.topics.map(t => {
    let g = slug(t.title) || 'topic-' + slug(t.n);
    if (taken.has(g)) g += '-' + slug(t.n);
    taken.add(g);
    return { ...t, url: url + g + '/', q: t.subs.reduce((a, x) => a + nq(x), 0) };
  });
  const c = { k, L, s, lv, url, boards, topics, name: lv.course(s.name), color: C.SUBJ_COL[k] || s.color || '#4361EE' };
  c.q = topics.reduce((a, t) => a + t.q, 0);
  c.subs = topics.reduce((a, t) => a + t.subs.length, 0);
  // where each subtopic lives: its topic page, so board pages can link to it
  c.home = new Map(topics.flatMap(t => t.subs.map(x => [keyOf(x), t])));
  courses.push(c);
}
const bySubject = k => courses.filter(c => c.k === k);
const byLevel = L => courses.filter(c => c.L === L);

// ---------- page frame
const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%234361EE'/%3E%3Cpath d='M9 16.5l4.5 4.5L23 11.5' fill='none' stroke='white' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#4361EE"/><path d="M9 16.5l4.5 4.5L23 11.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const DARK = '--bg:#141A2C;--bg2:#1B2337;--paper:#1C2439;--ink:#E9EDF6;--muted:#A3ACC0;--line:#2B3550;--stain:#7B93FF;--stain-soft:#232F5C;--ok:#4ADE80;--ok-soft:#14321F;--bad:#F87171;--bad-soft:#3A1C1C;--stage:linear-gradient(135deg,#3D55D6 0%,#6D3FD6 100%);--shadow:0 1px 0 rgba(255,255,255,.02),0 14px 40px -18px rgba(0,0,0,.6)';
const CSS = `:root{--bg:#F7F8FC;--bg2:#EEF1F8;--paper:#fff;--ink:#1B2236;--muted:#5D667A;--line:#E3E7F0;--stain:#4361EE;--stain-soft:#EDF1FF;--ok:#15803D;--ok-soft:#E7F7ED;--bad:#DC2626;--bad-soft:#FFECEC;--stage:linear-gradient(135deg,#4361EE 0%,#7C3AED 100%);--shadow:0 1px 2px rgba(27,34,54,.04),0 8px 24px -14px rgba(27,34,54,.14);--r:16px;--sc:#4361EE;--sct:var(--sc)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${DARK}}}
:root[data-theme="dark"]{${DARK}}
@supports (color:color-mix(in srgb,red,blue)){:root{--sct:color-mix(in srgb,var(--sc) 72%,var(--ink))}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--stain);text-underline-offset:2px}
h1,h2,h3{font-family:"Plus Jakarta Sans",Inter,system-ui,sans-serif;line-height:1.2;letter-spacing:-.01em}
h1{font-size:clamp(30px,6.4vw,46px);margin:0 0 14px}
h2{font-size:clamp(21px,3.6vw,26px);margin:0 0 14px}
h3{font-size:18px;margin:0 0 8px}
.wrap{max-width:900px;margin:0 auto;padding:0 16px}
.top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}
.brand{display:flex;align-items:center;gap:9px;font:800 18px "Plus Jakarta Sans",Inter,sans-serif;color:var(--ink);text-decoration:none}
.brand svg{width:28px;height:28px;flex:none}
.top nav{display:flex;align-items:center;gap:16px;font-weight:600;font-size:15px}
.top nav a:not(.btn){color:var(--muted);text-decoration:none}
.top nav a:not(.btn):hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 20px;border-radius:999px;background:var(--stain);color:#fff;font-weight:700;text-decoration:none;line-height:1.25;text-align:center}
.btn:hover{filter:brightness(1.08)}
.btn.sm{padding:8px 14px;font-size:14px}
.btn.ghost{background:transparent;color:var(--stain);box-shadow:inset 0 0 0 1.5px currentColor}
.crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:4px 8px;padding:0;margin:22px 0 0;font-size:14px;color:var(--muted)}
.crumbs li+li::before{content:"›";margin-right:8px}
.crumbs a{color:var(--muted)}
.hero{padding:20px 0 4px}
.eyebrow{font-weight:700;font-size:13px;color:var(--sct);text-transform:uppercase;letter-spacing:.07em;margin:0 0 10px}
.lead{font-size:18px;color:var(--muted);margin:0 0 12px}
.hero p{max-width:68ch}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 0;padding:0;list-style:none}
.stats li{background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:14px;font-weight:600}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 0}
main section{margin:44px 0 0}
.muted{color:var(--muted)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:var(--r);padding:clamp(18px,4vw,28px);box-shadow:var(--shadow)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
a.tile{display:flex;flex-direction:column;gap:4px;background:var(--paper);border:1px solid var(--line);border-left:4px solid var(--sc);border-radius:14px;padding:16px 18px;color:var(--ink);text-decoration:none;box-shadow:var(--shadow);transition:transform .15s ease,box-shadow .15s ease}
a.tile:hover{transform:translateY(-2px);box-shadow:0 14px 30px -18px rgba(27,34,54,.35)}
.tile small{color:var(--sct);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.tile b{font:700 18px/1.3 "Plus Jakarta Sans",Inter,sans-serif}
.tile span{color:var(--muted);font-size:15px}
.tile em{font-style:normal;color:var(--muted);font-size:14px;font-weight:600;margin-top:auto;padding-top:6px}
.subs{list-style:none;padding:0;margin:0;display:grid;gap:8px}
.subs li{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.subs .n{font-weight:700;color:var(--sct);min-width:2.6em}
.subs .t{flex:1 1 14em;font-weight:600}
.subs .t a{color:inherit;text-decoration-color:var(--line);text-decoration-thickness:2px}
.subs .t a:hover{color:var(--stain);text-decoration-color:currentColor}
.subs .m{color:var(--muted);font-size:14px}
.subs li.on{border-color:var(--ok)}
.tag{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 9px;border-radius:999px;vertical-align:middle}
.tag.free{background:var(--ok-soft);color:var(--ok)}
.tag.app{background:var(--stain-soft);color:var(--stain)}
.notes h2{margin-bottom:6px}
.notes h3{margin-top:26px}
.notes ul{padding-left:22px;margin:8px 0 0}
.notes li{margin:8px 0}
figure{margin:20px 0 6px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center}
figure img{width:100%;max-width:680px;height:auto;display:block;margin:0 auto}
.q{border-top:1px solid var(--line);padding:18px 0 4px}
.q:first-of-type{border-top:0;padding-top:4px}
.q .qt{font-weight:600;margin:0}
.q .qt b{color:var(--sct);margin-right:4px}
.opts{list-style:none;padding:0;margin:12px 0;display:grid;gap:8px}
.opts li{border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;background:var(--bg)}
.opts li::before{content:attr(data-l) ". ";font-weight:700;color:var(--muted)}
.js .q:not(.done) .opts li{cursor:pointer}
.js .q:not(.done) .opts li:hover,.opts li:focus-visible{border-color:var(--stain);outline:none}
.opts li.right{border-color:var(--ok);background:var(--ok-soft)}
.opts li.wrong{border-color:var(--bad);background:var(--bad-soft)}
details{margin:0 0 10px}
summary{cursor:pointer;color:var(--stain);font-weight:600;width:max-content;max-width:100%}
details p{margin:8px 0 0}
.tally{font-weight:700;color:var(--sct);min-height:1.6em;margin:0}
.cta{background:var(--stage);color:#fff;border-radius:20px;padding:clamp(20px,5vw,32px);box-shadow:var(--shadow)}
.cta h2{color:#fff;margin-bottom:8px}
.cta p{color:rgba(255,255,255,.9);margin:0;max-width:62ch}
.cta .btn{background:#fff;color:#2F3FB8}
.cta .btn.ghost{background:transparent;color:#fff;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.75)}
.boards{display:grid;gap:8px;padding:0;margin:0;list-style:none}
.boards li{display:grid;grid-template-columns:7em 1fr;gap:2px 12px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pager a{display:block;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px;text-decoration:none;color:var(--ink);font-weight:600}
.pager a small{display:block;color:var(--muted);font-weight:600;font-size:13px}
.pager .next{text-align:right;grid-column:2}
.foot{border-top:1px solid var(--line);margin-top:64px;padding:26px 0 44px;color:var(--muted);font-size:14px}
.foot .wrap{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:space-between}
.foot a{color:var(--muted)}
[id]{scroll-margin-top:76px}
@media (max-width:560px){.top nav .hide-s{display:none}.lead{font-size:17px}.pager{grid-template-columns:1fr}.pager .next{grid-column:1}.boards li{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){a.tile{transition:none}a.tile:hover{transform:none}}`;
// the questions answer themselves when tapped; without JavaScript they still work through "Show answer"
const SCRIPT = `<script>(function(){var d=document;d.documentElement.classList.add('js');var qs=d.querySelectorAll('.q'),t=d.querySelector('.tally'),n=0,r=0;
qs.forEach(function(q){q.querySelectorAll('.opts li').forEach(function(li,i){li.tabIndex=0;li.setAttribute('role','button');li.onclick=function(){if(q.classList.contains('done'))return;q.classList.add('done');var a=+q.dataset.a,o=q.querySelectorAll('.opts li');o[a].classList.add('right');if(i!==a)o[i].classList.add('wrong');else r++;n++;var s=q.querySelector('details');if(s)s.open=true;if(t)t.textContent=r+' of '+n+' right'+(n===qs.length?' \\u2014 well done for finishing!':' so far')};li.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();li.click()}}})})})();</script>`;

// A visit counted the way the app counts it (Stats in index.html): no cookie and nothing that identifies anyone.
// An arrival from outside the site is a visit; every page is a page view. Off for robots and in the owner's browser.
const beacon = subj => API ? `<script>(function(){try{var d=document,N=navigator;if(N.webdriver||!N.sendBeacon||localStorage.getItem('fm-nostats')==='1')return;var r='',x=0;try{var u=d.referrer?new URL(d.referrer):null;if(u&&u.host!==location.host){x=1;r=u.hostname}}catch(e){}
var n=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0]||{}).type||'navigate',q=new URLSearchParams(location.search),b={views:[['revision',${JSON.stringify(subj || '')}]]};
if(n==='navigate'&&(x||!d.referrer)){var s=Math.min(screen.width,screen.height);b.visit=1;b.ref=r;b.utm=q.get('utm_source')||'';b.dev=matchMedia('(pointer:coarse)').matches?(s<600?'phone':'tablet'):'desktop';b.lang=(N.language||'').slice(0,2).toLowerCase();b.land='revision'}
N.sendBeacon(${JSON.stringify(API + '/t')},JSON.stringify(b))}catch(e){}})();</script>` : '';

function page({ url, title, desc, crumbs, body, color, subj = '', type = 'website', ld = [] }) {
  const canon = SITE + url;
  const graph = [{ '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + u })) }, ...ld];
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="Full Marks">
<meta property="og:locale" content="en_GB">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${SITE}/img/share.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Full Marks: GCSE and A-level revision">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#4361EE">
<link rel="icon" href="${ICON}">
<script>try{document.documentElement.dataset.theme=localStorage.getItem('fm-theme')==='dark'?'dark':'light'}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
${CSS}
</style>
<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': graph })}</script>
</head>
<body${color ? ` style="--sc:${esc(color)}"` : ''}>
<header class="top"><div class="wrap"><a class="brand" href="/">${LOGO}<span>Full Marks</span></a><nav aria-label="Main"><a class="hide-s" href="/${DIR}/">Revision notes</a><a class="hide-s" href="/#pricing">Pricing</a><a class="btn sm" href="/#study">Open Full Marks</a></nav></div></header>
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map(([n, u], i) => i === crumbs.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${u}">${esc(n)}</a></li>`).join('')}</ol></nav>
${body.trim()}
</main>
<footer class="foot"><div class="wrap"><span>© Full Marks · fullmarkss.com</span><span><a href="/${DIR}/">Revision notes</a> · <a href="/#pricing">Pricing</a> · <a href="/#teacher">For teachers</a> · <a href="/terms.html">Terms</a> · <a href="/privacy.html">Privacy</a></span></div></footer>
${body.includes('class="q"') ? SCRIPT + '\n' : ''}${beacon(subj)}
</body>
</html>
`;
}
const ORG = { '@type': 'Organization', '@id': SITE + '/#org', name: 'Full Marks', url: SITE + '/' };
const crumbsOf = c => [['Full Marks', '/'], ['Revision', `/${DIR}/`], [c.lv.name, `/${DIR}/${c.lv.slug}/`], [c.s.name, c.url]];
const tile = (href, small, b, span, em) => `<a class="tile" href="${href}">${small ? `<small>${esc(small)}</small>` : ''}<b>${esc(b)}</b>${span ? `<span>${esc(span)}</span>` : ''}${em ? `<em>${esc(em)}</em>` : ''}</a>`;
const intro = t => (t.i || []).filter(p => !/^(Topic|Module|Unit|Paper|Component) [\w.]+: .*\.$/.test(p.trim()));
const boardsLine = c => list(c.boards.map(x => x.label));

// ---------- pages
const pages = [], files = new Map();
const add = (url, html) => { pages.push(url); files.set(url.slice(1) + 'index.html', html); };

function hubPage() {
  const nT = courses.reduce((a, c) => a + c.topics.length, 0), nS = courses.reduce((a, c) => a + c.subs, 0), nQ = courses.reduce((a, c) => a + c.q, 0);
  const subjects = Object.keys(C.SUBJECTS).filter(k => bySubject(k).length);
  const body = `
<header class="hero">
<p class="eyebrow">Free revision notes</p>
<h1>GCSE and A-level revision notes and questions</h1>
<p class="lead">Clear notes, diagrams and exam-style practice questions for ${plural(subjects.length, 'subject')}, from GCSE to the end of A-level, written for AQA, OCR, Edexcel and Cambridge. The first part of every topic is free to read here, with answers explained.</p>
<ul class="stats"><li>${plural(nT, 'topic')}</li><li>${plural(nS, 'subtopic')}</li><li>${plural(nQ, 'exam-style question')}</li></ul>
<div class="actions"><a class="btn" href="/#study">Start revising in Full Marks</a></div>
</header>
${C.LEVELS.filter(([L]) => LEVEL[L] && byLevel(L).length).map(([L]) => `
<section>
<h2><a href="/${DIR}/${LEVEL[L].slug}/">${esc(LEVEL[L].name)}</a> <span class="muted" style="font-size:.7em;font-weight:600">${esc(LEVEL[L].years)}</span></h2>
<div class="grid">${byLevel(L).map(c => `<div style="--sc:${c.color};display:contents">${tile(c.url, c.s.name, c.name, `${plural(c.topics.length, 'topic')} · ${plural(c.q, 'question')}`)}</div>`).join('')}</div>
</section>`).join('')}
<section class="cta">
<h2>Revise smarter with Full Marks</h2>
<p>Every subtopic has notes, 3D models and practice questions in levels, plus games, timed exams and past papers. Pick your exam board and Full Marks follows your specification.</p>
<div class="actions"><a class="btn" href="/#study">Open Full Marks</a><a class="btn ghost" href="/#pricing">See full access</a></div>
</section>`;
  add(`/${DIR}/`, page({
    url: `/${DIR}/`, title: 'GCSE and A-level revision notes and practice questions | Full Marks',
    desc: 'Free GCSE and A-level revision notes, diagrams and exam-style questions with answers for every topic, written for AQA, OCR, Edexcel and Cambridge.',
    crumbs: [['Full Marks', '/'], ['Revision', `/${DIR}/`]], body,
    ld: [{ '@type': 'CollectionPage', name: 'GCSE and A-level revision notes', url: SITE + `/${DIR}/`, inLanguage: 'en-GB', publisher: ORG }],
  }));
}

function levelPage(L) {
  const lv = LEVEL[L], cs = byLevel(L), url = `/${DIR}/${lv.slug}/`;
  const body = `
<header class="hero">
<p class="eyebrow">${esc(lv.years)}</p>
<h1>${esc(lv.name)} revision notes and questions</h1>
<p class="lead">Pick your subject for topic-by-topic ${esc(lv.name)} notes, diagrams and exam-style questions with answers, for ${esc(list([...new Set(cs.flatMap(c => c.boards.map(x => x.label.replace(/ [AB]$/, ''))))]))}.</p>
</header>
<section>
<div class="grid">${cs.map(c => `<div style="--sc:${c.color};display:contents">${tile(c.url, `${plural(c.topics.length, 'topic')}`, c.name, c.topics.slice(0, 3).map(t => t.title).join(' · ') + (c.topics.length > 3 ? ' …' : ''), plural(c.q, 'question'))}</div>`).join('')}</div>
</section>
<section>
<h2>Other levels</h2>
<div class="grid">${C.LEVELS.filter(([x]) => x !== L && LEVEL[x] && byLevel(x).length).map(([x]) => tile(`/${DIR}/${LEVEL[x].slug}/`, LEVEL[x].years, `${LEVEL[x].name} revision`, list(byLevel(x).map(c => c.s.name)))).join('')}</div>
</section>`;
  add(url, page({
    url, title: `${lv.name} revision notes and practice questions | Full Marks`,
    desc: clip(`Free ${lv.name} revision notes and exam-style questions with answers for ${list(cs.map(c => c.s.name))}.`),
    crumbs: [['Full Marks', '/'], ['Revision', `/${DIR}/`], [lv.name, url]], body,
    ld: [{ '@type': 'CollectionPage', name: `${lv.name} revision notes`, url: SITE + url, inLanguage: 'en-GB', publisher: ORG }],
  }));
}

function coursePage(c) {
  const others = bySubject(c.k).filter(x => x !== c);
  const body = `
<header class="hero">
<p class="eyebrow">${esc(c.lv.years)}</p>
<h1>${esc(c.name)} revision</h1>
<p class="lead">Notes, diagrams and exam-style questions for every topic in ${esc(c.name)}${c.boards.length ? `, for ${esc(boardsLine(c))}` : ''}. The first part of each topic is free to read here, with practice questions and answers.</p>
<ul class="stats"><li>${plural(c.topics.length, 'topic')}</li><li>${plural(c.subs, 'subtopic')}</li><li>${plural(c.q, 'question')}</li></ul>
<div class="actions"><a class="btn" href="${appLink(c.k, c.L)}">Start ${esc(c.name)} in Full Marks</a></div>
</header>
${c.boards.length ? `<section>
<h2>Choose your exam board</h2>
<div class="grid">${c.boards.map(x => tile(x.url, x.label, x.spec, x.note || `${plural(x.topics.length, 'topic')} in specification order`)).join('')}</div>
</section>` : ''}
<section>
<h2>Topics</h2>
<div class="grid">${c.topics.map(t => tile(t.url, `Topic ${t.n}`, t.title, clip(intro(t)[0] || '', 130), `${plural(t.subs.length, 'subtopic')} · ${plural(t.q, 'question')}`)).join('')}</div>
</section>
${others.length ? `<section>
<h2>${esc(c.s.name)} at other levels</h2>
<div class="grid">${others.map(x => tile(x.url, x.lv.years, x.name, `${plural(x.topics.length, 'topic')} · ${plural(x.q, 'question')}`)).join('')}</div>
</section>` : ''}`;
  add(c.url, page({
    url: c.url, color: c.color, subj: c.k, title: `${c.name} revision notes and practice questions | Full Marks`,
    desc: clip(`Free ${c.name} revision notes and exam-style questions with answers: ${list(c.topics.map(t => t.title))}.`),
    crumbs: crumbsOf(c), body,
    ld: [{ '@type': 'CollectionPage', name: `${c.name} revision`, url: SITE + c.url, inLanguage: 'en-GB', about: c.s.name, educationalLevel: c.lv.name, publisher: ORG }],
  }));
}

function boardPage(c, x) {
  const others = c.boards.filter(y => y !== x);
  const body = `
<header class="hero">
<p class="eyebrow">${esc(c.name)} · ${esc(x.label)}</p>
<h1>${esc(x.label)} ${esc(c.name)} revision</h1>
<p class="lead">Every topic of the ${esc(x.spec)} specification${x.note ? ` (${esc(x.note)})` : ''} in order, with notes and practice questions. Subtopics marked free have their notes and questions on this site.</p>
<div class="actions"><a class="btn" href="${appLink(c.k, c.L, x.b)}">Study ${esc(x.label)} ${esc(c.name)} in Full Marks</a></div>
</header>
${x.topics.map(bt => `
<section id="t-${slug(bt.n)}">
<h2>Topic ${esc(bt.n)}: ${esc(bt.title)}</h2>
${intro(bt).map(p => `<p class="muted">${md(p)}</p>`).join('')}
<ol class="subs">${bt.subs.map(s => {
    const home = c.home.get(keyOf(s));
    const t = home ? `<a href="${home.url}${isFree(s) ? '#notes' : '#' + anchor(keyOf(s))}">${esc(s.title)}</a>` : esc(s.title);
    return `<li><span class="n">${esc(s.n)}</span><span class="t">${t}</span><span class="m">${isFree(s) ? '<span class="tag free">Free</span> ' : ''}${plural(nq(s), 'question')}</span></li>`;
  }).join('')}</ol>
</section>`).join('')}
${others.length ? `<section>
<h2>Other exam boards</h2>
<div class="grid">${others.map(y => tile(y.url, y.label, y.spec, y.note)).join('')}</div>
</section>` : ''}`;
  add(x.url, page({
    url: x.url, color: c.color, subj: c.k, title: fit(...[' revision notes and questions | Full Marks', ' revision notes', ' revision'].map(e => x.spec + (/^Year/.test(x.note) ? ' ' + x.note : '') + e)),
    desc: clip(`${x.label} ${c.name} revision for ${x.spec}: notes and exam-style questions for ${list(x.topics.map(t => t.title))}.`),
    crumbs: [...crumbsOf(c), [x.label, x.url]], body,
    ld: [{ '@type': 'CollectionPage', name: `${x.label} ${c.name} revision`, url: SITE + x.url, inLanguage: 'en-GB', about: x.spec, educationalLevel: c.lv.name, publisher: ORG }],
  }));
}

function topicPage(c, t, ti) {
  const x = t.subs.find(isFree), prev = c.topics[ti - 1], next = c.topics[ti + 1];
  const keys = new Set(t.subs.map(keyOf));
  // where this topic sits in each board's specification
  const onBoards = c.boards.map(b => ({ b, hits: b.topics.filter(bt => bt.subs.some(s => keys.has(keyOf(s)))) }));
  const missing = onBoards.filter(o => !o.hits.length).map(o => o.b.label);
  let notes = '', qs = '';
  if (x) {
    const d = safeSvg(x.d), img = slug(x.title) + '.svg';
    if (d) files.set(t.url.slice(1) + img, d.svg + '\n');
    else if (x.d) console.warn(`diagram skipped (not a plain drawing): ${c.k} ${c.L} ${x.n}`);
    notes = `
<section id="notes" class="card notes">
<p class="eyebrow">${esc(x.n)} · Free notes</p>
<h2>${esc(x.title)}</h2>
${d ? `<figure><img src="${img}" width="${d.w}" height="${d.h}" alt="Diagram: ${esc(x.title)}" loading="lazy" decoding="async"></figure>` : ''}
<h3>Key points</h3>
<ul>${x.notes.map(n => `<li>${md(n)}</li>`).join('')}</ul>
${x.x && x.x.length ? `<h3>In more detail</h3>
<ul>${x.x.map(n => `<li>${md(n)}</li>`).join('')}</ul>` : ''}
</section>`;
    if (x.q && x.q.length) qs = `
<section id="questions" class="card">
<p class="eyebrow">Practice</p>
<h2>${esc(x.title)}: ${plural(x.q.length, 'question')}</h2>
<p class="muted">Pick an answer to check it, or open the answer for the explanation.</p>
<p class="tally" aria-live="polite"></p>
${x.q.map((q, i) => `<div class="q" data-a="${+q[2]}">
<p class="qt"><b>${i + 1}.</b> ${md(q[0])}</p>
<ol class="opts">${q[1].map((o, j) => `<li data-l="${'ABCDEFGH'[j]}">${md(o)}</li>`).join('')}</ol>
<details><summary>Show answer</summary><p><strong>${'ABCDEFGH'[+q[2]]}: ${md(q[1][+q[2]])}.</strong> ${md(q[3] || '')}</p></details>
</div>`).join('\n')}
</section>`;
  }
  const more = x ? Math.max(0, nq(x) - x.q.length) : 0;
  const body = `
<header class="hero">
<p class="eyebrow">${esc(c.name)} · Topic ${esc(t.n)}</p>
<h1>${esc(t.title)}</h1>
${intro(t).map(p => `<p>${md(p)}</p>`).join('')}
<ul class="stats"><li>${plural(t.subs.length, 'subtopic')}</li><li>${plural(t.q, 'question')}</li>${x ? `<li>Free: ${esc(x.n)} notes and ${plural(x.q.length, 'question')}</li>` : ''}</ul>
</header>
<section>
<h2>In this topic</h2>
<ol class="subs">${t.subs.map(s => `<li id="${anchor(keyOf(s))}"${isFree(s) ? ' class="on"' : ''}><span class="n">${esc(s.n)}</span><span class="t">${isFree(s) ? `<a href="#notes">${esc(s.title)}</a>` : esc(s.title)}</span><span class="m">${isFree(s) ? '<span class="tag free">Free below</span>' : `<a href="${appLink(c.k, c.L, keyOf(s))}">Open in Full Marks</a>`} · ${plural(nq(s), 'question')}</span></li>`).join('')}</ol>
</section>
${notes}
${qs}
<section class="cta">
<h2>Keep going in Full Marks</h2>
<p>${x ? `Full Marks has ${plural(nq(x), 'question')} on ${esc(x.title)}${more ? ` (${fmt(more)} more than here)` : ''}, set out in practice levels. You also get ` : 'You get '}notes and 3D models for all ${plural(t.subs.length, 'subtopic')} of ${esc(t.title)}, plus games, timed exams and past papers.</p>
<div class="actions">${x ? `<a class="btn" href="${appLink(c.k, c.L, keyOf(x), 'practice')}">Practise ${esc(x.n)} in Full Marks</a>` : ''}<a class="btn ghost" href="${appLink(c.k, c.L, keyOf(t.subs[0]), 'topic')}">Open ${esc(t.title)}</a></div>
</section>
${c.boards.length ? `<section>
<h2>On your exam board</h2>
<ul class="boards">${onBoards.filter(o => o.hits.length).map(o => `<li><b>${esc(o.b.label)}</b><span>${o.hits.map(bt => `<a href="${o.b.url}#t-${slug(bt.n)}">Topic ${esc(bt.n)}: ${esc(bt.title)}</a>`).join(', ')}</span></li>`).join('')}</ul>
${missing.length ? `<p class="muted">Not in the ${esc(list(missing))} specification${missing.length > 1 ? 's' : ''}.</p>` : ''}
</section>` : ''}
<section>
<nav class="pager" aria-label="Topics">${prev ? `<a href="${prev.url}"><small>← Topic ${esc(prev.n)}</small>${esc(prev.title)}</a>` : ''}${next ? `<a class="next" href="${next.url}"><small>Topic ${esc(next.n)} →</small>${esc(next.title)}</a>` : ''}</nav>
<p><a href="${c.url}">All ${esc(c.name)} topics</a></p>
</section>`;
  const lead = x ? plain(x.notes.slice(0, 2).join(' ')) : plain(intro(t).join(' '));
  add(t.url, page({
    url: t.url, color: c.color, subj: c.k, type: 'article',
    title: fit(`${t.title}: ${c.name} revision notes and questions | Full Marks`, `${t.title}: ${c.name} revision notes`, `${t.title} | ${c.name}`),
    desc: clip(x ? `${t.title} for ${c.name}: free revision notes and ${plural(x.q.length, 'practice question')} with answers. ${lead}` : `${t.title} for ${c.name}: ${lead}`),
    crumbs: [...crumbsOf(c), [t.title, t.url]], body,
    ld: [{
      '@type': 'LearningResource', name: `${t.title}: ${c.name} revision notes`, url: SITE + t.url, inLanguage: 'en-GB',
      learningResourceType: ['Revision notes', 'Practice questions'], educationalLevel: c.lv.name, about: [c.s.name, t.title],
      isAccessibleForFree: true, teaches: t.subs.map(s => s.title), publisher: ORG,
    }],
  }));
}

hubPage();
for (const [L] of C.LEVELS) if (LEVEL[L] && byLevel(L).length) levelPage(L);
for (const c of courses) {
  coursePage(c);
  for (const x of c.boards) boardPage(c, x);
  c.topics.forEach((t, i) => topicPage(c, t, i));
}

// ---------- write: only changed files, remove pages that no longer exist, keep lastmod for unchanged pages
const abs = p => path.join(ROOT, p);
const read = p => { try { return fs.readFileSync(abs(p), 'utf8'); } catch { return null; } };
const oldMod = new Map([...(read('sitemap.xml') || '').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(m => [m[1], m[2]]));
let wrote = 0, removed = 0;
const mods = new Map();
for (const [p, body] of files) {
  const same = read(p) === body;
  if (p.endsWith('index.html')) mods.set(SITE + '/' + p.replace(/index\.html$/, ''), same && oldMod.get(SITE + '/' + p.replace(/index\.html$/, '')) || TODAY);
  if (same) continue;
  fs.mkdirSync(path.dirname(abs(p)), { recursive: true });
  fs.writeFileSync(abs(p), body);
  wrote++;
}
(function prune(d) {
  if (!fs.existsSync(abs(d))) return;
  for (const e of fs.readdirSync(abs(d), { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) { prune(p); if (!fs.readdirSync(abs(p)).length) fs.rmdirSync(abs(p)); }
    else if (!files.has(p)) { fs.unlinkSync(abs(p)); removed++; }
  }
})(DIR);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE}/</loc></url>
${pages.map(u => `<url><loc>${SITE + u}</loc><lastmod>${mods.get(SITE + u)}</lastmod></url>`).join('\n')}
</urlset>
`;
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
for (const [p, body] of [['sitemap.xml', sitemap], ['robots.txt', robots]]) if (read(p) !== body) { fs.writeFileSync(abs(p), body); wrote++; }
console.log(`Revision pages: ${pages.length} pages (${courses.length} courses, ${courses.reduce((a, c) => a + c.boards.length, 0)} board pages, ${courses.reduce((a, c) => a + c.topics.length, 0)} topic pages), ${wrote} files written, ${removed} removed.`);
