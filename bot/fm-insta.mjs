// Instagram posts for Full Marks (GCSE and A-level revision, fullmarkss.com) in the site's look:
// indigo and violet, Plus Jakarta Sans, and the app's green mascot. Into
// Desktop/JARVIS/Full Marks Instagram/<date>/.
//
//   node fm-insta.mjs                     next post (format, subject, level and look rotate)
//   node fm-insta.mjs --subject physics   a chosen subject (--level GCSE|AS|A2,
//                                         --format quiz|challenge|notes|flashcards)
//
// Formats: quiz (one question), challenge (three questions), notes (a subtopic in
// 60 seconds, then a quick check) and flashcards (five key terms). Every post opens
// with a big cover that can be read in the profile grid. Covers go brand → paper →
// night in turn, so each column of the grid keeps one look.
// Questions and subtopics used are remembered (fm-historia.json), so none comes back,
// and the subjects go round in turn before any repeats.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { FM_INSTAGRAM, today } from './plocha.mjs'
import { creativeCaption } from './popis.mjs'
import { C, BRAND_BG, SUBJECT_COLOUR, fontCss, mascot, logo, icon, esc, FIT_SCRIPT, shoot } from './fm-look.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') ? true : all[i + 1] ?? true]] : a), []))
const BANK = process.env.FM_BANK || join(homedir(), 'genetic-os-backend', 'content', 'premium.json')
const { SUBJECTS } = JSON.parse(readFileSync(BANK, 'utf8'))
const OUT = FM_INSTAGRAM
const MEMORY = join(here, 'fm-historia.json')
const SITE = 'fullmarkss.com'
const LEVELS = ['GCSE', 'AS', 'A2']
const LEVEL_NAME = { GCSE: 'GCSE', AS: 'A-level · Year 12', A2: 'A-level · Year 13' }
const FORMATS = ['quiz', 'notes', 'challenge', 'flashcards']
const L = 'ABCD'

const memo = (() => { try { return JSON.parse(readFileSync(MEMORY, 'utf8')) } catch { return {} } })()
memo.posts ??= []; memo.used ??= []; memo.subs ??= []
const used = new Set(memo.used)
const usedSubs = new Set(memo.subs)

// ---------- the question bank ----------
// The extra questions (content/extra/<subject>.<level>.json) are used when the backend copy has them.
const extraCache = {}
const extraOf = (s, l) => (extraCache[`${s}.${l}`] ??= (() => { try { return JSON.parse(readFileSync(join(dirname(BANK), 'extra', `${s}.${l}.json`), 'utf8')) } catch { return {} } })())
const subsOf = (s, l) => {
  const d = SUBJECTS[s]?.[l]
  return d?.full ? d.topics.flatMap((t) => t.subs.map((x) => ({ ...x, topic: t.title }))) : []
}
// Fill-in-the-gap questions made from the notes read badly as posts, so they are left out.
const shortQ = (q) => Array.isArray(q?.[1]) && q[1].length === 4 && !/^complete the|_{3,}/i.test(q[0]) && q[0].length <= 150 && q[1].every((o) => o.length <= 64) && String(q[3] ?? '').length >= 30 && String(q[3] ?? '').length <= 230 && !used.has(q[0])
const questionsOf = (s, l) => {
  const d = SUBJECTS[s]?.[l]
  if (!d) return []
  const ex = extraOf(s, l)
  const all = d.full ? subsOf(s, l).flatMap((x) => [...(x.q ?? []), ...(ex[x.n] ?? [])]) : d.q ?? []
  return all.filter(shortQ)
}
const plain = (n) => String(n).replace(/\*\*/g, '').trim()
const rich = (n, colour) => esc(n).replace(/\*\*([^*]+)\*\*/g, `<b style="color:${colour}">$1</b>`)
const isTip = (n) => /^\**\s*exam (technique|tip)/i.test(n)
const isEval = (n) => /^\**\s*evaluation/i.test(n)
const notesFor = (x) => {
  const notes = (x.notes ?? []).filter((n) => typeof n === 'string')
  const key = notes.filter((n) => !isTip(n) && !isEval(n) && plain(n).length >= 40 && plain(n).length <= 235)
  const tip = notes.find((n) => isTip(n) && plain(n).length <= 260)
  return { key: key.slice(0, 4), tip }
}
const cardsFor = (x) => {
  const seen = new Set()
  return (x.notes ?? []).flatMap((n) => {
    const m = typeof n === 'string' && n.match(/\*\*([^*]{2,46})\*\*/)
    if (!m || m.index > 40 || isTip(n) || isEval(n) || plain(n).length > 230) return []
    const t0 = m[1].replace(/[:.]$/, '').trim()
    const term = t0[0].toUpperCase() + t0.slice(1)
    // A key term is words, not a formula.
    if (/[=<>≤≥∫Σ√^]/.test(term) || (term.match(/[A-Za-z]/g) ?? []).length < term.length * 0.6) return []
    if (seen.has(term.toLowerCase())) return []
    seen.add(term.toLowerCase())
    return [{ term, def: n }]
  }).slice(0, 5)
}
const SMALL = /\s+(and|or|of|the|a|an|to|in|for|with|on|&)$/i
const shortTitle = (t) => {
  const full = String(t ?? '').trim()
  if (full.length <= 38) return full
  let [head, ...rest] = full.split(/: | – | — | \(/)
  const tail = rest.join(' ').replace(/\)$/, '').trim()
  // "Required practical: making salts" says more after the colon than before it.
  if (tail && /practical|introduction|overview|basics|part \d/i.test(head)) head = tail[0].toUpperCase() + tail.slice(1)
  head = head.trim()
  if (head.length > 38 && head.includes(', ') && head.split(', ')[0].length <= 38) head = head.split(', ')[0]
  if (head.length <= 38) return head.replace(SMALL, '')
  // Cut before "and", "of"… the phrase is complete; anywhere else it gets an ellipsis.
  const cut = head.slice(0, 37).replace(/\s+\S*$/, '')
  return SMALL.test(cut) ? cut.replace(SMALL, '') : cut + '…'
}
const subsFor = (s, l, f) => subsOf(s, l).filter((x) => !usedSubs.has(`${s}.${l}.${x.n}`) && (f === 'notes' ? notesFor(x).key.length >= 4 : cardsFor(x).length >= 4))
const canDo = (s, l, f) => (f === 'quiz' || f === 'challenge') ? questionsOf(s, l).length >= 3 : subsFor(s, l, f).length > 0

// ---------- what to post ----------
const lastFormat = memo.posts.at(-1)?.format
let format = FORMATS.includes(args.format) ? args.format : FORMATS[(FORMATS.indexOf(lastFormat) + 1) % FORMATS.length]
const subjects = Object.keys(SUBJECTS).filter((s) => LEVELS.some((l) => SUBJECTS[s]?.[l]))
const lastAt = (s) => Math.max(-1, ...memo.posts.map((p, i) => (p.subject === s ? i : -1)))
const pickSubject = (f) => SUBJECTS[args.subject] ? args.subject
  : subjects.slice().sort((a, b) => lastAt(a) - lastAt(b) || Math.random() - 0.5).find((s) => LEVELS.some((l) => canDo(s, l, f)))
let subject = pickSubject(format)
if (!subject || !LEVELS.some((l) => canDo(subject, l, format))) {
  // The bank on this Mac has no notes for this format: fall back to a quiz.
  format = format === 'challenge' ? 'challenge' : 'quiz'
  subject = pickSubject(format)
}
if (!subject) throw new Error('Every question has been used – clear fm-historia.json to start again.')
const levelCount = (l) => memo.posts.filter((p) => p.subject === subject && p.level === l).length
const level = LEVELS.includes(args.level) && canDo(subject, args.level, format) ? args.level
  : LEVELS.filter((l) => canDo(subject, l, format)).sort((a, b) => levelCount(a) - levelCount(b) || Math.random() - 0.5)[0]
if (!level) throw new Error(`No ${format} left for ${subject}.`)
const name = SUBJECTS[subject].name ?? subject
const acc = SUBJECT_COLOUR[subject] ?? C.indigo
const tag = `${name} · ${LEVEL_NAME[level]}`

let qs = []; let sub = null; let notes = null; let cards = []; let check = null
if (format === 'quiz' || format === 'challenge') {
  qs = questionsOf(subject, level).sort(() => Math.random() - 0.5).slice(0, format === 'quiz' ? 1 : 3)
} else {
  const pool = subsFor(subject, level, format)
  sub = pool[Math.floor(Math.random() * pool.length)]
  if (format === 'notes') {
    notes = notesFor(sub)
    check = [...(sub.q ?? []), ...(extraOf(subject, level)[sub.n] ?? [])].filter(shortQ).sort(() => Math.random() - 0.5)[0] ?? null
  } else cards = cardsFor(sub)
}
const topicTitle = sub ? (shortTitle(sub.title).endsWith('…') && !shortTitle(sub.topic).endsWith('…') ? shortTitle(sub.topic) : shortTitle(sub.title)) : ''

// ---------- the look ----------
// Covers go brand → paper → night, so the grid's columns each keep one look.
const LOOK_ORDER = ['brand', 'paper', 'night']
const grid = Number.isInteger(memo.grid) ? memo.grid : memo.posts.length
const lookName = LOOK_ORDER[grid % 3]
const COVER = {
  brand: { bg: BRAND_BG, ink: '#fff', sub: 'rgba(255,255,255,.86)', em: '#FFD166', chip: 'rgba(255,255,255,.16)', chipInk: '#fff', onDark: true },
  paper: { bg: `radial-gradient(760px 760px at 108% -8%,${acc}2E,transparent 68%),radial-gradient(640px 640px at -10% 108%,${C.indigo}1F,transparent 70%),${C.paper}`, ink: C.ink, sub: C.muted, em: acc, chip: '#fff', chipInk: C.ink, onDark: false },
  night: { bg: `radial-gradient(820px 720px at 105% -5%,${acc}5C,transparent 64%),radial-gradient(700px 640px at -8% 108%,${C.indigo}55,transparent 70%),${C.night}`, ink: C.nightInk, sub: C.nightMuted, em: acc, chip: 'rgba(255,255,255,.08)', chipInk: C.nightInk, onDark: true },
}[lookName]
const INNER = lookName === 'night'
  ? { bg: `radial-gradient(700px 600px at 100% 0%,${acc}33,transparent 65%),${C.night}`, ink: C.nightInk, sub: C.nightMuted, card: C.night2, line: '#2B3550', dim: 'rgba(233,237,246,.42)', onDark: true }
  : { bg: lookName === 'brand' ? '#F3F4FF' : C.paper, ink: C.ink, sub: C.muted, card: '#fff', line: C.line, dim: 'rgba(27,34,54,.40)', onDark: false }

const FORMAT_LABEL = { quiz: ['Quiz', 'quiz'], challenge: ['Challenge', 'target'], notes: ['60-second notes', 'bulb'], flashcards: ['Flashcards', 'cards'] }[format]
const pick = (list, key) => {
  const recent = memo.posts.slice(-6).map((p) => p.hook)
  const fresh = list.map((_, i) => i).filter((i) => !recent.includes(`${key}${i}`))
  const i = (fresh.length ? fresh : list.map((_, k) => k))[Math.floor(Math.random() * (fresh.length || list.length))]
  return [list[i], `${key}${i}`]
}
const HOOKS = {
  quiz: ['Can you get this <em>right?</em>', 'Quick <em>quiz</em>', '10 seconds. <em>Go.</em>', 'Do you know <em>this one?</em>', 'Test <em>yourself</em>', 'Exam-style <em>question</em>'],
  challenge: ['3 questions. <em>No notes.</em>', 'Can you score <em>3/3?</em>', 'The 3-question <em>challenge</em>', 'How many can you <em>get?</em>'],
  notes: [`${esc(topicTitle)} in <em>60 seconds</em>`, `Revise <em>${esc(topicTitle)}</em>`, `${esc(topicTitle)}: <em>the essentials</em>`],
  flashcards: [`${cards.length} key terms: <em>${esc(topicTitle)}</em>`, `Key terms you <em>must know</em>`],
}
const [hook, hookId] = pick(HOOKS[format], format[0])
const LEDE = {
  quiz: 'Answer on slide 3. Comment yours first.',
  challenge: 'Keep score. Answers on slide 5.',
  notes: 'Save it, read it, then test yourself on the last slide.',
  flashcards: hook.startsWith('Key terms') ? `${esc(topicTitle)}. Save this for revision.` : 'Cover the definition and say it out loud.',
}[format]
const DECO = { quiz: '?', challenge: '3', notes: '60', flashcards: 'Aa' }[format]
const MASCOT = { quiz: 'think', challenge: 'wow', notes: 'happy', flashcards: 'happy' }[format]

// ---------- slides ----------
const base = (bg, ink, inner) => `<!doctype html><html><head><meta charset="utf-8">${fontCss()}<style>
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:${bg};color:${ink};font-family:Inter,sans-serif;display:flex;flex-direction:column;overflow:hidden;position:relative}
.j{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-weight:800;letter-spacing:-.03em}
em{font-style:normal}
h1,h2,h3,.lede,.q,.p{text-wrap:balance}
${inner}</style>${FIT_SCRIPT}</head>`

const chip = (bg, ink, size = 34) => `<div style="display:inline-flex;align-items:center;gap:16px;padding:16px 28px 16px 20px;border-radius:999px;background:${bg};color:${ink};font-weight:600;font-size:${size}px;${bg === '#fff' ? 'box-shadow:0 8px 24px rgba(27,34,54,.08)' : ''}">
<span style="width:${size * 1.6}px;height:${size * 1.6}px;border-radius:50%;background:${acc};display:flex;align-items:center;justify-content:center">${icon(subject, size, '#fff', 2.2)}</span>${esc(tag)}</div>`

function cover() {
  const k = COVER
  return `${base(k.bg, k.ink, `
header{display:flex;justify-content:space-between;align-items:center;padding:84px 90px 0}
.pill{display:flex;align-items:center;gap:12px;padding:20px 28px;border-radius:999px;background:${k.onDark ? 'rgba(255,255,255,.14)' : C.ink};color:#fff;font-weight:700;font-size:28px;text-transform:uppercase;letter-spacing:.06em}
main{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:0 90px 330px;overflow:hidden}
h1{font-size:${hook.replace(/<[^>]+>/g, '').length > 30 ? 118 : 138}px;line-height:1;margin:44px 0 0;max-width:900px}
h1 em{color:${k.em}}
.lede{font-size:42px;line-height:1.35;color:${k.sub};margin-top:40px;max-width:700px;font-weight:500}
.deco{position:absolute;right:-70px;top:110px;font-family:'Plus Jakarta Sans';font-weight:800;font-size:${DECO.length > 1 ? 560 : 900}px;line-height:.8;letter-spacing:-.06em;color:${k.onDark ? 'rgba(255,255,255,.07)' : 'rgba(27,34,54,.05)'};transform:rotate(8deg);pointer-events:none}
header,main{position:relative}
.swipe{position:absolute;left:90px;bottom:96px;display:flex;align-items:center;gap:16px;font-weight:700;font-size:34px;color:${k.ink}}
.swipe i{width:64px;height:64px;border-radius:50%;background:${k.onDark ? '#fff' : C.indigo};color:${k.onDark ? C.indigo : '#fff'};display:flex;align-items:center;justify-content:center;font-style:normal;font-size:34px}
.mas{position:absolute;right:56px;bottom:70px}`)}<body><div class="deco">${DECO}</div>
<header>${logo(k.onDark, 58)}</header>
<main data-box><div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">${chip(k.chip, k.chipInk)}<div class="pill">${icon(FORMAT_LABEL[1], 30, '#fff', 2.4)}${FORMAT_LABEL[0]}</div></div><h1 class="j" data-fit>${hook}</h1><p class="lede" data-fit>${LEDE}</p></main>
<div class="swipe"><i>→</i>Swipe</div><div class="mas">${mascot(MASCOT, 360, 'c')}</div></body></html>`
}

function inner(n, total, content, { last = false } = {}) {
  const k = INNER
  const bar = Array.from({ length: total }, (_, i) => `<span style="flex:1;height:8px;border-radius:8px;background:${i < n ? acc : k.line}"></span>`).join('')
  return `${base(k.bg, k.ink, `
header{display:flex;justify-content:space-between;align-items:center;padding:76px 90px 0;gap:20px}
main{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:30px 90px 20px;overflow:hidden}
footer{display:flex;align-items:center;gap:30px;padding:0 90px 80px}
footer .bar{flex:1;display:flex;gap:10px}footer b{font-size:30px;font-weight:700;white-space:nowrap}
.eye{display:flex;align-items:center;gap:14px;font-weight:700;font-size:30px;text-transform:uppercase;letter-spacing:.08em;color:${acc}}
.q{font-size:66px;line-height:1.12;margin:26px 0 44px}
.opt{display:flex;align-items:center;gap:26px;background:${k.card};border:2px solid ${k.line};border-radius:28px;padding:24px 30px;margin-bottom:18px;font-size:40px;font-weight:500;line-height:1.25}
.opt>b{width:66px;height:66px;border-radius:20px;flex:none;display:flex;align-items:center;justify-content:center;background:${acc}1F;color:${acc};font-family:'Plus Jakarta Sans';font-weight:800;font-size:34px}
.opt.ok{background:${k.onDark ? '#14321F' : C.okSoft};border-color:${C.ok};font-weight:600}.opt.ok>b{background:${C.ok};color:#fff}
.opt.no{color:${k.dim}}.opt.no>b{opacity:.5}
.why{display:flex;gap:24px;align-items:flex-start;background:${k.card};border-radius:28px;padding:30px 34px;margin-top:20px;border:2px solid ${k.line}}
.why p{font-size:36px;line-height:1.42;color:${k.ink}}.why p b{display:block;font-family:'Plus Jakarta Sans';font-weight:800;font-size:32px;color:${acc};margin-bottom:6px}
.hint{display:flex;align-items:center;gap:14px;font-size:32px;font-weight:600;color:${k.sub};margin-top:18px}
.note{display:flex;gap:28px;align-items:flex-start;background:${k.card};border:2px solid ${k.line};border-radius:30px;padding:34px 38px;margin-top:26px}
.note .num{width:70px;height:70px;border-radius:22px;flex:none;background:${acc};color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Plus Jakarta Sans';font-weight:800;font-size:36px}
.note p{font-size:42px;line-height:1.38}
.card{background:${k.card};border-radius:40px;padding:70px 64px;border:2px solid ${k.line};box-shadow:0 30px 80px rgba(27,34,54,${k.onDark ? '.35' : '.10'});position:relative;overflow:hidden}
.card:before{content:'';position:absolute;left:0;top:0;right:0;height:16px;background:${acc}}
.term{font-size:92px;line-height:1.04;color:${acc};margin:26px 0 38px}
.def{font-size:46px;line-height:1.42}
.ans{display:flex;gap:24px;align-items:flex-start;margin-top:34px}.ans .ck{width:62px;height:62px;border-radius:50%;background:${C.ok};flex:none;display:flex;align-items:center;justify-content:center}
.ans h3{font-family:'Plus Jakarta Sans';font-weight:800;font-size:42px;line-height:1.2;letter-spacing:-.02em}.ans p{font-size:32px;line-height:1.4;color:${k.sub};margin-top:8px}`)}<body>
<header>${logo(k.onDark, 46)}<div style="display:flex;align-items:center;gap:18px">${chip(k.onDark ? 'rgba(255,255,255,.08)' : '#fff', k.ink, 26)}<span style="font-weight:700;font-size:28px;color:${k.sub}">${n}/${total}</span></div></header>
<main data-box>${content}</main>
<footer><div class="bar">${bar}</div><b style="color:${last ? acc : k.sub}">${last ? SITE : 'Swipe →'}</b></footer></body></html>`
}

const options = (q, answer = false) => q[1].map((o, k) => `<div class="opt${answer ? (k === q[2] ? ' ok' : ' no') : ''}"><b>${answer && k === q[2] ? icon('check', 36, '#fff', 3) : L[k]}</b><span data-fit>${esc(o)}</span></div>`).join('')
const questionSlide = (q, i, n, total, label) => inner(n, total, `<div class="eye">${icon('quiz', 34, acc, 2.4)}${label}</div>
<h2 class="j q" data-fit>${esc(q[0])}</h2>${options(q)}
<p class="hint">${icon('hand', 34, INNER.sub, 2)}${format === 'challenge' ? 'Note your answer, then swipe' : 'Comment A, B, C or D, then swipe'}</p>`, n, total)
const answerSlide = (q, n, total) => inner(n, total, `<div class="eye">${icon('check', 34, acc, 2.6)}Answer</div>
<p style="font-size:34px;line-height:1.35;color:${INNER.sub};margin:20px 0 30px;font-weight:500" data-fit>${esc(q[0])}</p>${options(q, true)}
${q[3] ? `<div class="why">${icon('bulb', 52, acc, 2)}<p data-fit><b>Why?</b>${esc(q[3])}</p></div>` : ''}`, n, total)
const answersSlide = (list, n, total) => inner(n, total, `<div class="eye">${icon('check', 34, acc, 2.6)}Answers · how did you do?</div>
${list.map((q, i) => `<div class="ans"><span class="ck">${icon('check', 36, '#fff', 3)}</span><div><h3 data-fit>Q${i + 1}: ${L[q[2]]}) ${esc(q[1][q[2]])}</h3>${q[3] ? `<p data-fit>${esc(q[3])}</p>` : ''}</div></div>`).join('')}
<p class="hint" style="margin-top:44px">${icon('star', 34, INNER.sub, 2)}Comment your score out of 3</p>`, n, total)
const notesSlide = (list, from, n, total, label) => inner(n, total, `<div class="eye">${icon('bulb', 34, acc, 2.4)}${label}</div>
<h2 class="j" style="font-size:58px;line-height:1.1;margin-top:18px" data-fit>${esc(sub.title)}</h2>
${list.map((t, i) => `<div class="note"><span class="num">${from + i}</span><p data-fit>${rich(t, acc)}</p></div>`).join('')}`, n, total)
const tipSlide = (t, n, total) => inner(n, total, `<div class="card"><div class="eye" style="color:#D97706">${icon('star', 38, '#D97706', 2.4)}Exam tip</div>
<p class="def" style="margin-top:30px;font-size:46px" data-fit>${rich(t.replace(/^\**\s*exam (technique|tip)\s*:?\**\s*:?\s*/i, '').replace(/^\**[a-z]/, (c) => c.toUpperCase()), acc)}</p></div>`, n, total)
const cardSlide = (c, i, n, total) => inner(n, total, `<div class="card"><div class="eye">${icon('cards', 34, acc, 2.4)}Key term ${i + 1} of ${cards.length}</div>
<p class="j term" data-fit>${esc(c.term)}</p><p class="def" data-fit>${rich(c.def, acc)}</p></div>`, n, total)

function cta() {
  return `${base(BRAND_BG, '#fff', `
header{padding:84px 90px 0}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 90px 60px}
h2{font-size:96px;line-height:1.02;margin-top:34px}h2 em{color:#FFD166}
.p{font-size:40px;line-height:1.42;color:rgba(255,255,255,.88);margin-top:30px;max-width:860px;font-weight:500}
.btn{margin-top:50px;background:#fff;color:${C.indigo};font-family:'Plus Jakarta Sans';font-weight:800;font-size:44px;padding:30px 56px;border-radius:999px;box-shadow:0 20px 50px rgba(20,26,44,.25)}
.row{display:flex;gap:44px;margin-top:46px;font-weight:600;font-size:32px;color:rgba(255,255,255,.9)}.row span{display:flex;align-items:center;gap:12px}`)}<body>
<header>${logo(true, 58)}</header>
<main>${mascot('cheer', 360, 'e')}<h2 class="j">Get full marks in <em>${esc(name)}</em>.</h2>
<p class="p">100,000+ exam-style questions, clear notes and past papers for AQA, OCR, Edexcel and Cambridge.</p>
<div class="btn">Start free · ${SITE}</div>
<div class="row"><span>${icon('bookmark', 36, '#fff', 2.2)}Save for revision</span><span>${icon('hand', 36, '#fff', 2)}Link in bio</span></div></main></body></html>`
}

let slides
if (format === 'quiz') slides = [cover(), questionSlide(qs[0], 0, 2, 4, 'Question'), answerSlide(qs[0], 3, 4), cta()]
else if (format === 'challenge') slides = [cover(), ...qs.map((q, i) => questionSlide(q, i, i + 2, 6, `Question ${i + 1} of 3`)), answersSlide(qs, 5, 6), cta()]
else if (format === 'notes') {
  const pages = [[notes.key.slice(0, 2), 1], [notes.key.slice(2, 4), 3]]
  const total = 1 + pages.length + (notes.tip ? 1 : 0) + (check ? 2 : 0) + 1
  let n = 1
  slides = [cover(), ...pages.map(([list, from], i) => notesSlide(list, from, ++n, total, `Key points ${i + 1}/${pages.length}`))]
  if (notes.tip) slides.push(tipSlide(notes.tip, ++n, total))
  if (check) { slides.push(questionSlide(check, 0, ++n, total, 'Quick check')); slides.push(answerSlide(check, ++n, total)) }
  slides.push(cta())
} else {
  const total = cards.length + 2
  slides = [cover(), ...cards.map((c, i) => cardSlide(c, i, i + 2, total)), cta()]
}

// ---------- render ----------
const date = today()
mkdirSync(OUT, { recursive: true })
let k = 1
while (existsSync(join(OUT, k === 1 ? date : `${date}-${k}`))) k++
const dir = join(OUT, k === 1 ? date : `${date}-${k}`)
mkdirSync(dir, { recursive: true })
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } })
for (const [i, html] of slides.entries()) await shoot(tab, html, join(dir, `${i + 1}.png`))
await browser.close()

// ---------- caption ----------
const tags = ['#gcse', '#alevel', '#revision', '#studygram', '#studytips', `#${subject === 'computing' ? 'computerscience' : subject === 'further' ? 'furthermaths' : subject}`, `#${level === 'GCSE' ? 'gcserevision' : 'alevelrevision'}`, '#exams', '#fullmarks', '#ukstudents']
const answerAt = format === 'quiz' ? 3 : 5
let caption = {
  quiz: () => `${name} quiz (${LEVEL_NAME[level]}) 🧠\n\n${qs[0][0]}\n${qs[0][1].map((o, k) => `${L[k]}) ${o}`).join('\n')}\n\nComment your answer 👇 – it's on slide ${answerAt}.\n\nWant full marks? 100,000+ exam-style questions and notes on ${SITE} (link in bio).`,
  challenge: () => `3-question ${name} challenge (${LEVEL_NAME[level]}) – how many can you get? 🔥\n\nAnswers on slide ${answerAt}. Comment your score /3 👇\n\nMore questions like these on ${SITE} (link in bio).`,
  notes: () => `${shortTitle(sub.title)} in 60 seconds (${name}, ${LEVEL_NAME[level]}) 📚\n\nSave this for revision 🔖${check ? ' and test yourself on the quick check at the end' : ''}.\n\nFull notes and 100,000+ exam-style questions on ${SITE} (link in bio).`,
  flashcards: () => `${cards.length} key terms for ${shortTitle(sub.title)} (${name}, ${LEVEL_NAME[level]}) 🗂️\n\nSave this, cover each definition and say it out loud before you swipe.\n\nMore on ${SITE} (link in bio).`,
}[format]() + `\n\n${tags.join(' ')}`
const about = { quiz: 'one-question quiz carousel', challenge: '3-question challenge carousel', notes: '60-second revision notes carousel with a quick check', flashcards: 'key-term flashcards carousel' }[format]
caption = await creativeCaption('fullmarks', caption, `${about}, ${name} ${LEVEL_NAME[level]}${sub ? `, topic: ${sub.title}` : ''}`)
writeFileSync(join(dir, 'popis.txt'), `${caption}\n`)

memo.posts.push({ date, dir: dir.split(/[\\/]/).pop(), subject, level, format, look: lookName, hook: hookId, created: Date.now() })
memo.used.push(...qs.map((q) => q[0]), ...(check ? [check[0]] : []))
if (sub) memo.subs.push(`${subject}.${level}.${sub.n}`)
memo.grid = grid + 1
writeFileSync(MEMORY, JSON.stringify(memo, null, 1))
const what = { quiz: 'quiz', challenge: '3-question challenge', notes: `60-second notes on ${shortTitle(sub?.title ?? '')}`, flashcards: `${cards.length} flashcards on ${shortTitle(sub?.title ?? '')}` }[format]
console.log(`Full Marks Instagram post ready: ${what} (${slides.length} pictures), ${name} ${level}, ${lookName} look: ${dir}\n\n${caption}`)
if (process.platform === 'darwin' && !process.env.NO_OPEN) execFile('open', [dir])
