// Full Marks Instagram Stories that can be posted through the API (1080×1920 JPEG,
// no stickers, since the API cannot add them): a quiz in two frames (question, then
// answer), an exam tip from the notes, or a "new post" story showing a post's cover.
//
//   node fm-story-api.mjs quiz <outDir>
//   node fm-story-api.mjs tip <outDir>
//   node fm-story-api.mjs promo <outDir> <cover.jpg> [Post|Reel]
//
// Prints the files it made, one per line. Uses fm-historia.json so nothing repeats.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { C, BRAND_BG, SUBJECT_COLOUR, fontCss, mascot, logo, icon, esc, FIT_SCRIPT } from './fm-look.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const [mode = 'quiz', out = join(here, 'stories'), cover, kind = 'Post'] = process.argv.slice(2)
const BANK = process.env.FM_BANK || join(homedir(), 'genetic-os-backend', 'content', 'premium.json')
const { SUBJECTS } = JSON.parse(readFileSync(BANK, 'utf8'))
const MEMORY = join(here, 'fm-historia.json')
const HANDLE = process.env.FM_HANDLE || '@full.marks1'
const LEVELS = ['GCSE', 'AS', 'A2']
const LEVEL_NAME = { GCSE: 'GCSE', AS: 'A-level · Year 12', A2: 'A-level · Year 13' }
const L = 'ABCD'
const memo = (() => { try { return JSON.parse(readFileSync(MEMORY, 'utf8')) } catch { return {} } })()
memo.posts ??= []; memo.used ??= []; memo.tips ??= []; memo.stories ??= []
const used = new Set(memo.used)
const subjects = Object.keys(SUBJECTS).filter((s) => LEVELS.some((l) => SUBJECTS[s]?.[l]?.full))
const pickSubject = () => {
  const last = (s) => Math.max(-1, ...memo.stories.map((x, i) => (x.subject === s ? i : -1)))
  return subjects.slice().sort((a, b) => last(a) - last(b) || Math.random() - 0.5)[0]
}
const rich = (n, colour) => esc(n).replace(/\*\*([^*]+)\*\*/g, `<b style="color:${colour}">$1</b>`)

const page = (inner, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${fontCss()}<style>
*{margin:0;box-sizing:border-box}body{width:1080px;height:1920px;overflow:hidden;background:${BRAND_BG};color:#fff;font-family:Inter,sans-serif;display:flex;flex-direction:column;padding:250px 84px 270px;position:relative}
.j{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:800;letter-spacing:-.03em}h1,h2,p{text-wrap:balance}
.chip{display:inline-flex;align-items:center;gap:16px;padding:16px 28px 16px 18px;border-radius:999px;background:rgba(255,255,255,.16);font-weight:600;font-size:36px;align-self:flex-start}
.chip i{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center}
.eye{display:flex;align-items:center;gap:14px;font-weight:700;font-size:34px;letter-spacing:.1em;text-transform:uppercase;color:#FFD166}
.opt{display:flex;align-items:center;gap:26px;background:rgba(255,255,255,.12);border:3px solid rgba(255,255,255,.22);border-radius:30px;padding:28px 32px;margin-bottom:20px;font-size:46px;font-weight:600;line-height:1.2}
.opt b{width:74px;height:74px;border-radius:22px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.2);font-family:'Plus Jakarta Sans';font-weight:800;font-size:38px}
.opt.ok{background:${C.ok};border-color:${C.ok}}.opt.no{opacity:.4}
.card{background:rgba(255,255,255,.12);border:3px solid rgba(255,255,255,.22);border-radius:36px;padding:44px 46px}
.foot{position:absolute;left:84px;right:84px;bottom:270px;display:flex;align-items:flex-end;justify-content:space-between;gap:30px}
.foot p{font-size:42px;font-weight:700;line-height:1.25}
${extra}</style>${FIT_SCRIPT}</head><body>${inner}</body></html>`

async function render(htmls) {
  mkdirSync(out, { recursive: true })
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } })
  const files = []
  for (const [name, html] of htmls) {
    await tab.setContent(html, { waitUntil: 'load' }).catch(() => {})
    await tab.evaluate(() => document.fonts.ready)
    await tab.evaluate(() => typeof fitAll === 'function' && fitAll())
    const f = join(out, name)
    await tab.screenshot({ path: f, type: 'jpeg', quality: 92 })
    files.push(f)
  }
  await browser.close()
  return files
}

let files = []
if (mode === 'quiz') {
  const fits = (q) => Array.isArray(q?.[1]) && q[1].length === 4 && !/^complete the|_{3,}/i.test(q[0]) && q[0].length <= 110 && q[1].every((o) => o.length <= 44) && String(q[3] ?? '').length >= 30 && String(q[3] ?? '').length <= 190 && !used.has(q[0])
  let s, l, q
  for (const cand of [pickSubject(), ...subjects]) {
    for (const lv of LEVELS.slice().sort(() => Math.random() - 0.5)) {
      const d = SUBJECTS[cand]?.[lv]
      if (!d?.full) continue
      const pool = d.topics.flatMap((t) => t.subs.flatMap((x) => x.q ?? [])).filter(fits)
      if (pool.length) { s = cand; l = lv; q = pool[Math.floor(Math.random() * pool.length)]; break }
    }
    if (q) break
  }
  const acc = SUBJECT_COLOUR[s] ?? C.indigo
  const chip = `<div class="chip"><i style="background:${acc}">${icon(s, 34, '#fff', 2.2)}</i>${esc(SUBJECTS[s].name)} · ${LEVEL_NAME[l]}</div>`
  const top = `<div style="position:absolute;top:120px;left:84px">${logo(true, 54)}</div>`
  const ask = page(`${top}<div class="eye">${icon('quiz', 38, '#FFD166', 2.4)}Quick quiz</div><div data-box style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding-bottom:300px;margin-top:30px">
${chip}<h1 class="j" style="font-size:76px;line-height:1.1;margin:50px 0 46px" data-fit>${esc(q[0])}</h1>${q[1].map((o, k) => `<div class="opt"><b>${L[k]}</b><span data-fit>${esc(o)}</span></div>`).join('')}</div>
<div class="foot"><p>Answer in the<br>next story →</p>${mascot('think', 300, 'q')}</div>`)
  const answer = page(`${top}<div class="eye">${icon('check', 38, '#FFD166', 2.6)}Answer</div><div data-box style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding-bottom:300px">
<p style="font-size:38px;line-height:1.35;color:rgba(255,255,255,.8);margin-bottom:36px" data-fit>${esc(q[0])}</p>${q[1].map((o, k) => `<div class="opt ${k === q[2] ? 'ok' : 'no'}"><b>${k === q[2] ? icon('check', 40, '#fff', 3) : L[k]}</b><span data-fit>${esc(o)}</span></div>`).join('')}
<div class="card" style="margin-top:20px;display:flex;gap:22px">${icon('bulb', 56, '#FFD166', 2)}<p style="font-size:40px;line-height:1.38" data-fit>${esc(q[3])}</p></div></div>
<div class="foot"><p>Follow ${esc(HANDLE)}<br>for a daily quiz</p>${mascot('cheer', 300, 'a')}</div>`)
  files = await render([['story-quiz-1.jpg', ask], ['story-quiz-2.jpg', answer]])
  memo.used.push(q[0])
  memo.stories.push({ date: new Date().toISOString().slice(0, 10), mode, subject: s, level: l })
} else if (mode === 'tip') {
  const isTip = (n) => /^\**\s*exam (technique|tip)/i.test(n)
  let s, l, tip, title
  for (const cand of [pickSubject(), ...subjects]) {
    for (const lv of LEVELS.slice().sort(() => Math.random() - 0.5)) {
      const d = SUBJECTS[cand]?.[lv]
      if (!d?.full) continue
      const pool = d.topics.flatMap((t) => t.subs.flatMap((x) => (x.notes ?? []).filter((n) => typeof n === 'string' && isTip(n) && n.length <= 260 && !memo.tips.includes(n)).map((n) => [n, x.title])))
      if (pool.length) { s = cand; l = lv; [tip, title] = pool[Math.floor(Math.random() * pool.length)]; break }
    }
    if (tip) break
  }
  const acc = SUBJECT_COLOUR[s] ?? C.indigo
  const text = tip.replace(/^\**\s*exam (technique|tip)\s*:?\**\s*:?\s*/i, '').replace(/^\**[a-z]/, (c) => c.toUpperCase())
  const html = page(`<div style="position:absolute;top:120px;left:84px">${logo(true, 54)}</div><div data-box style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;overflow:hidden;padding-bottom:320px">
<div class="eye">${icon('star', 40, '#FFD166', 2.4)}Exam tip</div>
<div class="chip" style="margin-top:34px"><i style="background:${acc}">${icon(s, 34, '#fff', 2.2)}</i>${esc(SUBJECTS[s].name)} · ${LEVEL_NAME[l]}</div>
<p style="font-size:44px;color:rgba(255,255,255,.8);margin-top:40px;font-weight:600" data-fit>${esc(title)}</p>
<p class="j" style="font-size:70px;line-height:1.15;margin-top:26px;letter-spacing:-.02em" data-fit>${rich(text, '#FFD166')}</p></div>
<div class="foot"><p>Save it for<br>your exam ⭐</p>${mascot('happy', 300, 't')}</div>`)
  files = await render([['story-tip.jpg', html]])
  memo.tips.push(tip)
  memo.stories.push({ date: new Date().toISOString().slice(0, 10), mode, subject: s, level: l })
} else if (mode === 'promo') {
  const img = `data:image/jpeg;base64,${readFileSync(cover).toString('base64')}`
  const ratio = kind === 'Reel' ? '9/16' : '4/5'
  const html = page(`<div style="position:absolute;top:120px;left:84px">${logo(true, 54)}</div>
<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:300px">
<div class="eye" style="margin-bottom:44px">${icon('star', 38, '#FFD166', 2.4)}New ${kind.toLowerCase()}</div>
<img src="${img}" style="width:${kind === 'Reel' ? 560 : 760}px;aspect-ratio:${ratio};object-fit:cover;border-radius:36px;transform:rotate(-3deg);box-shadow:0 40px 90px rgba(10,14,30,.45);border:8px solid #fff"></div>
<div class="foot"><p>Tap our profile<br>to see it 👆</p>${mascot('wow', 300, 'p')}</div>`)
  files = await render([['story-promo.jpg', html]])
  memo.stories.push({ date: new Date().toISOString().slice(0, 10), mode })
}
writeFileSync(MEMORY, JSON.stringify(memo, null, 1))
console.log(files.join('\n'))
