// Halloween Stories for Full Marks (1080×1920 JPEG): a "spooky season" story,
// then a spooky science quiz in two frames (question, answer).
//   node fm-halloween-story.mjs <outDir>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fontCss, mascot, logo, icon } from './fm-look.mjs'

const out = process.argv[2] || 'halloween'
mkdirSync(out, { recursive: true })
const HANDLE = process.env.FM_HANDLE || '@full.marks1'

const bat = (x, y, w, r = 0, o = 1) => `<svg style="position:absolute;left:${x}px;top:${y}px;width:${w}px;transform:rotate(${r}deg);opacity:${o}" viewBox="0 0 64 40"><g fill="#07040F"><path d="M30 18C22 8 10 6 2 12c6 1 8 5 8 8 4-3 8-2 10 2 3-3 7-2 10 2z"/><path d="M34 18c8-10 20-12 28-6-6 1-8 5-8 8-4-3-8-2-10 2-3-3-7-2-10 2z"/><ellipse cx="32" cy="21" rx="4.2" ry="7"/><path d="M28.6 15.5 29.6 10.5l2.4 3 2.4-3 1 5z"/></g></svg>`
const pumpkin = (x, y, w) => `<svg style="position:absolute;left:${x}px;top:${y}px;width:${w}px;filter:drop-shadow(0 0 30px rgba(249,115,22,.6))" viewBox="0 0 120 104">
<path d="M58 22c0-8 3-14 9-18l5 4c-5 3-7 8-7 15z" fill="#3F6212"/><ellipse cx="38" cy="62" rx="30" ry="38" fill="#EA580C"/><ellipse cx="82" cy="62" rx="30" ry="38" fill="#EA580C"/><ellipse cx="60" cy="62" rx="30" ry="40" fill="#F97316"/>
<path d="M60 24c-6 12-6 64 0 78M60 24c6 12 6 64 0 78" fill="none" stroke="#C2410C" stroke-width="2.5" opacity=".7"/><path d="M36 50l12-8 4 14zM84 50l-12-8-4 14z" fill="#FDE68A"/><path d="M34 70q26 18 52 0l-8 6-6-5-6 6-6-6-6 6-6-5z" fill="#FDE68A"/></svg>`
const web = `<svg style="position:absolute;left:0;top:0;width:380px;opacity:.28" viewBox="0 0 200 200"><g fill="none" stroke="#fff" stroke-width="1.2"><path d="M0 0L200 70M0 0L170 170M0 0L70 200M0 0L200 10M0 0L10 200"/><path d="M40 14Q30 30 14 40M80 28Q62 60 28 80M120 42Q94 94 42 120M160 56Q126 126 56 160"/></g></svg>`
const scene = `<div style="position:absolute;right:-90px;top:170px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle at 38% 36%,#FFF7D6 0%,#FDE68A 45%,#F59E0B 100%);box-shadow:0 0 120px 40px rgba(251,191,36,.35),0 0 300px 120px rgba(249,115,22,.2)"></div>
${web}${bat(640, 300, 150, -8)}${bat(820, 470, 96, 10, .95)}${bat(120, 1460, 80, 8, .7)}`

const page = (inner) => `<!doctype html><html><head><meta charset="utf-8">${fontCss()}<style>
*{margin:0;box-sizing:border-box}body{width:1080px;height:1920px;overflow:hidden;position:relative;color:#fff;font-family:Inter,sans-serif;
background:radial-gradient(900px 700px at 80% 15%,rgba(124,58,237,.45),transparent 70%),radial-gradient(800px 700px at 10% 95%,rgba(234,88,12,.35),transparent 70%),linear-gradient(180deg,#0F0820 0%,#1E0B3A 60%,#2A0F2E 100%)}
.j{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:800;letter-spacing:-.03em}h1,h2,p{text-wrap:balance}
.eye{display:flex;align-items:center;gap:14px;font-weight:700;font-size:36px;letter-spacing:.1em;text-transform:uppercase;color:#FDBA74}
.opt{display:flex;align-items:center;gap:26px;background:rgba(255,255,255,.10);border:3px solid rgba(253,186,116,.35);border-radius:30px;padding:28px 32px;margin-bottom:20px;font-size:48px;font-weight:600}
.opt b{width:76px;height:76px;border-radius:22px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(249,115,22,.25);color:#FDBA74;font-family:'Plus Jakarta Sans';font-weight:800;font-size:40px}
.opt.ok{background:#16A34A;border-color:#16A34A}.opt.ok b{background:rgba(255,255,255,.25);color:#fff}.opt.no{opacity:.4}
.content{position:absolute;left:84px;right:84px;top:250px;bottom:300px;display:flex;flex-direction:column}
.foot{position:absolute;left:84px;right:84px;bottom:250px;display:flex;align-items:flex-end;justify-content:space-between}
.foot p{font-size:44px;font-weight:700;line-height:1.25}
</style></head><body>${scene}${inner}</body></html>`

const options = ['Infrared vision', 'Echolocation (ultrasound)', 'Earth’s magnetic field', 'Smell alone']
const answer = 1
const frames = [
  ['halloween-1.jpg', page(`<div style="position:absolute;top:120px;left:84px">${logo(true, 54)}</div>
<div class="content" style="justify-content:center;padding-bottom:420px"><div class="eye">🎃 Spooky season</div>
<h1 class="j" style="font-size:150px;line-height:.95;margin-top:30px">Don’t let your mocks <span style="color:#F97316">haunt you</span></h1>
<p style="font-size:48px;line-height:1.35;color:rgba(255,255,255,.85);margin-top:40px;font-weight:500">Quizzes, 60-second notes and flashcards for GCSE &amp; A-level.</p>
<div class="j" style="align-self:flex-start;margin-top:44px;background:#F97316;color:#fff;font-size:46px;padding:22px 40px;border-radius:999px;letter-spacing:-.01em">fullmarkss.com</div></div>
<div style="position:absolute;right:60px;bottom:330px">${mascot('cheer', 430, 'h1', 'witch')}</div>
${pumpkin(70, 1500, 200)}${pumpkin(250, 1560, 140)}`)],
  ['halloween-2.jpg', page(`<div style="position:absolute;top:120px;left:84px">${logo(true, 54)}</div>
<div class="content" style="justify-content:center;padding-bottom:180px"><div class="eye">🦇 Spooky science quiz</div>
<h1 class="j" style="font-size:88px;line-height:1.08;margin:40px 0 50px">How do bats find insects in the dark?</h1>
${options.map((o, k) => `<div class="opt"><b>${'ABCD'[k]}</b>${o}</div>`).join('')}</div>
<div class="foot"><p>Answer in the<br>next story →</p>${mascot('think', 300, 'h2', 'witch')}</div>`)],
  ['halloween-3.jpg', page(`<div style="position:absolute;top:120px;left:84px">${logo(true, 54)}</div>
<div class="content" style="justify-content:center;padding-bottom:180px"><div class="eye">${icon('check', 40, '#FDBA74', 2.6)}Answer</div>
<p style="font-size:42px;color:rgba(255,255,255,.75);margin:30px 0 40px">How do bats find insects in the dark?</p>
${options.map((o, k) => `<div class="opt ${k === answer ? 'ok' : 'no'}"><b>${k === answer ? icon('check', 42, '#fff', 3) : 'ABCD'[k]}</b>${o}</div>`).join('')}
<div style="margin-top:24px;background:rgba(255,255,255,.10);border:3px solid rgba(253,186,116,.35);border-radius:32px;padding:36px 40px;display:flex;gap:24px">${icon('bulb', 60, '#FDBA74', 2)}
<p style="font-size:42px;line-height:1.38">Bats send out <b style="color:#FDBA74">ultrasound</b> and listen for the echoes. Ultrasound scans and sonar use the same idea.</p></div></div>
<div class="foot"><p>Follow ${HANDLE}<br>for a daily quiz 👻</p>${mascot('cheer', 300, 'h3', 'witch')}</div>`)],
]
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
for (const [name, html] of frames) {
  await tab.setContent(html, { waitUntil: 'load' }).catch(() => {})
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: join(out, name), type: 'jpeg', quality: 92 })
  console.log(join(out, name))
}
await browser.close()
