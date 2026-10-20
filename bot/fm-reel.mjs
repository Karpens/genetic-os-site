// A Full Marks quiz Reel (1080×1920, 15 s, H.264 + AAC) in the Instagram look:
// a hook, a real question from the bank with a 5-second countdown, the answer
// with its explanation, then "follow for a daily quiz". Ticks and a chime are
// synthesised, so there is no music licence to worry about.
// Into <Full Marks Instagram>/<date>-reel/: reel.mp4, cover.jpg, popis.txt.
//
//   node fm-reel.mjs                     next subject in turn
//   node fm-reel.mjs --subject physics   a chosen subject (--level GCSE|AS|A2)
//
// Shares fm-historia.json with fm-insta.mjs: questions never repeat, and the
// cover follows the same brand → paper → night order so the grid stays tidy.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { FM_INSTAGRAM, today } from './plocha.mjs'
import { C, BRAND_BG, SUBJECT_COLOUR, fontCss, mascot, logo, icon, esc, FIT_SCRIPT } from './fm-look.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]] : a), []))
const BANK = process.env.FM_BANK || join(homedir(), 'genetic-os-backend', 'content', 'premium.json')
const { SUBJECTS } = JSON.parse(readFileSync(BANK, 'utf8'))
const MEMORY = join(here, 'fm-historia.json')
const HANDLE = process.env.FM_HANDLE || '@full.marks1'
const SITE = 'fullmarkss.com'
const LEVELS = ['GCSE', 'AS', 'A2']
const LEVEL_NAME = { GCSE: 'GCSE', AS: 'A-level · Year 12', A2: 'A-level · Year 13' }
const L = 'ABCD'
const FPS = 30
const DURATION = 15

const memo = (() => { try { return JSON.parse(readFileSync(MEMORY, 'utf8')) } catch { return {} } })()
memo.posts ??= []; memo.used ??= []
const used = new Set(memo.used)

// ---------- a short question nobody has seen yet ----------
const extraOf = (s, l) => { try { return JSON.parse(readFileSync(join(dirname(BANK), 'extra', `${s}.${l}.json`), 'utf8')) } catch { return {} } }
const fits = (q) => Array.isArray(q?.[1]) && q[1].length === 4 && !/^complete the|_{3,}/i.test(q[0]) && q[0].length <= 120 && q[1].every((o) => o.length <= 48) && String(q[3] ?? '').length >= 30 && String(q[3] ?? '').length <= 200 && !used.has(q[0])
const questionsOf = (s, l) => {
  const d = SUBJECTS[s]?.[l]
  if (!d) return []
  const ex = extraOf(s, l)
  return (d.full ? d.topics.flatMap((t) => t.subs.flatMap((x) => [...(x.q ?? []), ...(ex[x.n] ?? [])])) : d.q ?? []).filter(fits)
}
const subjects = Object.keys(SUBJECTS).filter((s) => LEVELS.some((l) => SUBJECTS[s]?.[l]))
const lastAt = (s) => Math.max(-1, ...memo.posts.map((p, i) => (p.subject === s ? i : -1)))
const subject = SUBJECTS[args.subject] ? args.subject : subjects.slice().sort((a, b) => lastAt(a) - lastAt(b) || Math.random() - 0.5).find((s) => LEVELS.some((l) => questionsOf(s, l).length))
if (!subject) throw new Error('No unused question left – clear fm-historia.json to start again.')
const level = LEVELS.includes(args.level) && questionsOf(subject, args.level).length ? args.level
  : LEVELS.filter((l) => questionsOf(subject, l).length).sort((a, b) => memo.posts.filter((p) => p.subject === subject && p.level === a).length - memo.posts.filter((p) => p.subject === subject && p.level === b).length || Math.random() - 0.5)[0]
const pool = questionsOf(subject, level)
const q = pool[Math.floor(Math.random() * pool.length)]
const name = SUBJECTS[subject].name ?? subject
const acc = SUBJECT_COLOUR[subject] ?? C.indigo
const tag = `${name} · ${LEVEL_NAME[level]}`

// ---------- the look (same rotation as the posts) ----------
const LOOK_ORDER = ['brand', 'paper', 'night']
const grid = Number.isInteger(memo.grid) ? memo.grid : memo.posts.length
const lookName = LOOK_ORDER[grid % 3]
const K = {
  brand: { bg: BRAND_BG, ink: '#fff', sub: 'rgba(255,255,255,.86)', em: '#FFD166', card: 'rgba(255,255,255,.12)', cardInk: '#fff', line: 'rgba(255,255,255,.22)', onDark: true },
  paper: { bg: `radial-gradient(900px 900px at 110% -5%,${acc}2E,transparent 68%),radial-gradient(800px 800px at -10% 105%,${C.indigo}1F,transparent 70%),${C.paper}`, ink: C.ink, sub: C.muted, em: acc, card: '#fff', cardInk: C.ink, line: C.line, onDark: false },
  night: { bg: `radial-gradient(1000px 900px at 105% -5%,${acc}5C,transparent 64%),radial-gradient(900px 800px at -8% 105%,${C.indigo}55,transparent 70%),${C.night}`, ink: C.nightInk, sub: C.nightMuted, em: acc, card: C.night2, cardInk: C.nightInk, line: '#2B3550', onDark: true },
}[lookName]

// Scene times (seconds)
const T = { hook: 0, question: 1.6, countFrom: 3.1, countTo: 8.1, reveal: 8.6, cta: 12.6 }
const HOOKS = ['Can you answer this in <em>5 seconds?</em>', '5 seconds. <em>Go.</em>', 'Only real revisers get <em>this one</em>', 'Quick quiz: <em>no notes</em>']
const hook = HOOKS[(memo.posts.filter((p) => p.format === 'reel').length) % HOOKS.length]

const html = `<!doctype html><html><head><meta charset="utf-8">${fontCss()}<style>
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;font-family:Inter,sans-serif;color:${K.ink};background:${K.bg};position:relative}
.j{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:800;letter-spacing:-.03em}em{font-style:normal;color:${K.em}}
h1,h2,p{text-wrap:balance}
.scene{position:absolute;inset:0;padding:150px 84px 160px;display:flex;flex-direction:column}
.chip{display:inline-flex;align-items:center;gap:16px;padding:16px 28px 16px 18px;border-radius:999px;background:${K.onDark ? 'rgba(255,255,255,.14)' : '#fff'};font-weight:600;font-size:36px;align-self:flex-start;${K.onDark ? '' : 'box-shadow:0 8px 24px rgba(27,34,54,.08)'}}
.chip i{width:58px;height:58px;border-radius:50%;background:${acc};display:flex;align-items:center;justify-content:center}
#hook h1{font-size:150px;line-height:.98;margin-top:60px}
#hook .sub{font-size:46px;color:${K.sub};margin-top:44px;font-weight:500}
#hook .mas{position:absolute;right:60px;bottom:220px}
#qs .top{display:flex;justify-content:space-between;align-items:center}
#qs .q{font-size:74px;line-height:1.1;margin:70px 0 56px}
.opt{display:flex;align-items:center;gap:28px;background:${K.card};color:${K.cardInk};border:3px solid ${K.line};border-radius:32px;padding:30px 34px;margin-bottom:22px;font-size:48px;font-weight:600;line-height:1.2}
.opt b{width:78px;height:78px;border-radius:24px;flex:none;display:flex;align-items:center;justify-content:center;background:${acc}26;color:${K.onDark ? '#fff' : acc};font-family:'Plus Jakarta Sans';font-weight:800;font-size:40px}
.opt.ok{background:${C.ok};border-color:${C.ok};color:#fff}.opt.ok b{background:rgba(255,255,255,.25);color:#fff}
.timer{width:150px;height:150px;position:relative}.timer svg{position:absolute;inset:0;transform:rotate(-90deg)}
.timer span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:72px}
.why{margin-top:26px;background:${K.onDark ? 'rgba(255,255,255,.10)' : '#fff'};border:3px solid ${K.line};border-radius:32px;padding:34px 38px;display:flex;gap:24px}
.why p{font-size:40px;line-height:1.38}.why p b{display:block;color:${K.em};font-family:'Plus Jakarta Sans';font-weight:800;font-size:38px;margin-bottom:8px}
#cta{background:${BRAND_BG};color:#fff;align-items:center;justify-content:center;text-align:center}
#cta h2{font-size:120px;line-height:1;margin-top:40px}#cta h2 em{color:#FFD166}
#cta p{font-size:48px;color:rgba(255,255,255,.88);margin-top:34px;font-weight:500}
#cta .btn{margin-top:60px;background:#fff;color:${C.indigo};font-family:'Plus Jakarta Sans';font-weight:800;font-size:54px;padding:34px 64px;border-radius:999px}
</style>${FIT_SCRIPT}</head><body>
<div class="scene" id="hook" data-box>${logo(K.onDark, 64)}<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-bottom:360px">
<div class="chip"><i>${icon(subject, 34, '#fff', 2.2)}</i>${esc(tag)}</div><h1 class="j" data-fit>${hook}</h1><p class="sub">Comment your answer before the reveal 👇</p></div>
<div class="mas">${mascot('think', 420, 'h')}</div></div>
<div class="scene" id="qs"><div class="top">${logo(K.onDark, 54)}<div class="timer"><svg width="150" height="150"><circle cx="75" cy="75" r="64" fill="none" stroke="${K.line}" stroke-width="12"/><circle id="ring" cx="75" cy="75" r="64" fill="none" stroke="${acc}" stroke-width="12" stroke-linecap="round" stroke-dasharray="402" stroke-dashoffset="0"/></svg><span id="num">5</span></div></div>
<div data-box style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden">
<div class="chip"><i>${icon(subject, 34, '#fff', 2.2)}</i>${esc(tag)}</div>
<h2 class="j q" data-fit>${esc(q[0])}</h2>
${q[1].map((o, k) => `<div class="opt" id="o${k}"><b>${L[k]}</b><span data-fit>${esc(o)}</span></div>`).join('')}
<div class="why" id="why">${icon('bulb', 60, K.em, 2)}<p data-fit><b>Why?</b>${esc(q[3])}</p></div></div></div>
<div class="scene" id="cta">${mascot('cheer', 520, 'c')}<h2 class="j">Follow for a <em>daily quiz</em></h2>
<p>GCSE &amp; A-level · AQA, OCR, Edexcel, Cambridge</p><div class="btn">${SITE}</div><p style="font-size:40px">${esc(HANDLE)}</p></div>
<script>
const T=${JSON.stringify(T)},ANS=${q[2]};
const clamp=(x)=>Math.max(0,Math.min(1,x)),ease=(x)=>1-Math.pow(1-clamp(x),3),back=(x)=>{x=clamp(x);const c=1.6;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const $=(id)=>document.getElementById(id);
function frame(t){
  const hook=$('hook'),qs=$('qs'),cta=$('cta');
  // hook: slide in, then fade out into the question
  const hi=ease(t/0.5),ho=ease((t-T.question+0.25)/0.35);
  hook.style.opacity=t<T.question?hi:1-ho;hook.style.transform='translateY('+((1-hi)*60)+'px)';
  // question scene
  const qi=ease((t-T.question+0.2)/0.4);
  qs.style.opacity=t<T.cta?qi:1-ease((t-T.cta)/0.35);
  for(let k=0;k<4;k++){const o=$('o'+k),a=back((t-T.question-0.35-k*0.15)/0.45);o.style.opacity=clamp((t-T.question-0.35-k*0.15)/0.3);o.style.transform='translateX('+((1-a)*-80)+'px)';
    if(t>=T.reveal){if(k===ANS){o.classList.add('ok');const p=clamp((t-T.reveal)/0.4);o.style.transform='scale('+(1+0.06*Math.sin(p*Math.PI))+')'}else{o.style.opacity=0.35}}else{o.classList.remove('ok')}}
  const left=Math.max(0,T.countTo-t),frac=t<T.countFrom?1:left/(T.countTo-T.countFrom);
  $('num').textContent=t<T.countFrom?'5':t>=T.countTo?'0':String(Math.ceil(left));
  $('ring').setAttribute('stroke-dashoffset',String(402*(1-frac)));
  const w=$('why'),wi=ease((t-T.reveal-0.3)/0.5);w.style.opacity=wi;w.style.transform='translateY('+((1-wi)*50)+'px)';
  // call to action
  const ci=ease((t-T.cta)/0.45);cta.style.opacity=ci;cta.style.transform='scale('+(0.94+0.06*ci)+')';
}
</script></body></html>`

// ---------- render the frames ----------
const date = today()
mkdirSync(FM_INSTAGRAM, { recursive: true })
let k = 1
while (existsSync(join(FM_INSTAGRAM, k === 1 ? `${date}-reel` : `${date}-reel-${k}`))) k++
const dir = join(FM_INSTAGRAM, k === 1 ? `${date}-reel` : `${date}-reel-${k}`)
const frames = join(dir, '.frames')
mkdirSync(frames, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
await tab.setContent(html, { waitUntil: 'load' }).catch(() => {})
await tab.evaluate(() => document.fonts.ready)
// Fit the long texts while everything is laid out, with the answer card in place.
await tab.evaluate(() => { for (const s of document.querySelectorAll('.scene')) s.style.opacity = 1; fitAll() })
const total = FPS * DURATION
for (let f = 0; f < total; f++) {
  await tab.evaluate((t) => frame(t), f / FPS)
  await tab.screenshot({ path: join(frames, `${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 })
}
// The cover: the hook, fully in.
await tab.evaluate(() => frame(1.0))
await tab.screenshot({ path: join(dir, 'cover.jpg'), type: 'jpeg', quality: 92 })
await browser.close()

// ---------- sound: soft chord, a tick each second of the countdown, a chime on the answer ----------
const ticks = [0, 1, 2, 3, 4].map((i) => T.countFrom + i)
const tick = (t0) => `0.35*sin(2*PI*1500*t)*exp(-70*(t-${t0}))*gte(t,${t0})`
const chime = `0.30*(sin(2*PI*880*t)+0.6*sin(2*PI*1318.5*t)+0.35*sin(2*PI*1760*t))*exp(-2.6*(t-${T.reveal}))*gte(t,${T.reveal})`
const pad = `0.035*(sin(2*PI*261.63*t)+sin(2*PI*329.63*t)+sin(2*PI*392*t))*(0.7+0.3*sin(2*PI*0.5*t))*min(1,t/1.5)*min(1,(${DURATION}-t)/1.5)`
const swell = `0.05*(sin(2*PI*392*t)+sin(2*PI*493.88*t)+sin(2*PI*587.33*t))*gte(t,${T.cta})*min(1,(t-${T.cta})/0.6)*min(1,(${DURATION}-t)/1.2)`
const expr = [pad, ...ticks.map(tick), chime, swell].join('+')
const ffmpeg = (() => {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try { return createRequire(import.meta.url).resolve('@ffmpeg-installer/linux-x64/ffmpeg') } catch {}
  try { return createRequire(import.meta.url)('@ffmpeg-installer/ffmpeg').path } catch {}
  return 'ffmpeg'
})()
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%04d.jpg'),
  '-f', 'lavfi', '-i', `aevalsrc='${expr}|${expr}':s=44100:d=${DURATION}`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-preset', 'veryfast', '-crf', '20', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', join(dir, 'reel.mp4')])
rmSync(frames, { recursive: true, force: true })

const tags = ['#gcse', '#alevel', '#revision', '#studygram', '#quiz', `#${subject === 'computing' ? 'computerscience' : subject === 'further' ? 'furthermaths' : subject}`, `#${level === 'GCSE' ? 'gcserevision' : 'alevelrevision'}`, '#exams', '#fullmarks', '#ukstudents']
const caption = `Can you answer this in 5 seconds? ⏱️ (${name}, ${LEVEL_NAME[level]})

${q[0]}
${q[1].map((o, i) => `${L[i]}) ${o}`).join('\n')}

Comment your answer before the reveal 👇 Follow for a new quiz every day.

100,000+ exam-style questions and notes on ${SITE} (link in bio).

${tags.join(' ')}`
writeFileSync(join(dir, 'popis.txt'), `${caption}\n`)
memo.posts.push({ date, dir: dir.split(/[\\/]/).pop(), subject, level, format: 'reel', look: lookName, created: Date.now() })
memo.used.push(q[0])
memo.grid = grid + 1
writeFileSync(MEMORY, JSON.stringify(memo, null, 1))
console.log(`Full Marks reel ready: ${name} ${level}, ${lookName} look, answer ${L[q[2]]}: ${dir}\n\n${caption}`)
