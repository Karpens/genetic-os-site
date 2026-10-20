// Today's Full Marks Instagram, ready to publish: a carousel post one day and a
// quiz Reel the next, plus Stories (post days: a "new post" story and an exam tip;
// Reel days: a quiz in two frames). Everything goes into ../ig/<date>/ as JPEG/MP4
// with plan.json, which lists what to publish, in order, with the captions.
//
//   FM_BANK=…/premium.json CHROMIUM_PATH=… node daily.mjs [--kind post|reel]
//
// Uses fm-insta.mjs, fm-reel.mjs and fm-story-api.mjs; fm-historia.json keeps the
// history, so nothing repeats and the grid keeps its brand → paper → night order.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { FM_INSTAGRAM, today } from './plocha.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const MEMORY = join(here, 'fm-historia.json')
const memo = () => { try { return JSON.parse(readFileSync(MEMORY, 'utf8')) } catch { return {} } }
const m0 = memo()
const lastKind = (m0.daily ?? []).at(-1)?.kind
const kind = args.includes('--kind') ? args[args.indexOf('--kind') + 1] : lastKind === 'post' ? 'reel' : 'post'
const date = today()
const dest = join(here, '..', 'ig', date)
mkdirSync(dest, { recursive: true })
const run = (script, a = []) => execFileSync(process.execPath, [script, ...a], { cwd: here, encoding: 'utf8', env: { ...process.env, NO_OPEN: '1' }, maxBuffer: 1 << 24 })
const caption = (dir) => readFileSync(join(dir, 'popis.txt'), 'utf8').trim()
const plan = { date, kind, items: [] }
const RUN = Date.now().toString(36)
const tag = (p) => `${kind}-${RUN}-${p}`

if (kind === 'post') {
  run('fm-insta.mjs')
  const m = memo()
  const dir = join(FM_INSTAGRAM, m.posts.at(-1).dir)
  const pngs = readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b))
  // Instagram takes JPEG only.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 } })
  const files = []
  for (const f of pngs) {
    await tab.setContent(`<body style="margin:0"><img style="display:block;width:1080px;height:1350px" src="data:image/png;base64,${readFileSync(join(dir, f)).toString('base64')}"></body>`)
    const name = tag(f.replace('.png', '.jpg'))
    await tab.screenshot({ path: join(dest, name), type: 'jpeg', quality: 92 })
    files.push(name)
  }
  await browser.close()
  plan.items.push({ type: 'carousel', files, caption: caption(dir), about: `${m.posts.at(-1).format} · ${m.posts.at(-1).subject} ${m.posts.at(-1).level}` })
  const promo = run('fm-story-api.mjs', ['promo', join(FM_INSTAGRAM, 'stories'), join(dest, files[0]), 'Post']).trim().split('\n').at(-1)
  const tip = run('fm-story-api.mjs', ['tip', join(FM_INSTAGRAM, 'stories')]).trim().split('\n').at(-1)
  for (const [f, p] of [[promo, 'story-promo.jpg'], [tip, 'story-tip.jpg']]) { copyFileSync(f, join(dest, tag(p))); plan.items.push({ type: 'story', files: [tag(p)] }) }
} else {
  run('fm-reel.mjs')
  const m = memo()
  const dir = join(FM_INSTAGRAM, m.posts.at(-1).dir)
  const video = tag('reel.mp4'), cover = tag('cover.jpg')
  copyFileSync(join(dir, 'reel.mp4'), join(dest, video))
  copyFileSync(join(dir, 'cover.jpg'), join(dest, cover))
  plan.items.push({ type: 'reel', files: [video], cover, caption: caption(dir), about: `quiz reel · ${m.posts.at(-1).subject} ${m.posts.at(-1).level}` })
  const quiz = run('fm-story-api.mjs', ['quiz', join(FM_INSTAGRAM, 'stories')]).trim().split('\n')
  quiz.forEach((f, i) => { const n = tag(`story-quiz-${i + 1}.jpg`); copyFileSync(f, join(dest, n)); plan.items.push({ type: 'story', files: [n] }) })
}
// Several runs on one day each add their own items.
const planFile = join(dest, 'plan.json')
const old = existsSync(planFile) ? JSON.parse(readFileSync(planFile, 'utf8')) : null
const all = old ? { ...old, items: [...old.items, ...plan.items.map((x) => ({ ...x, run: 2 }))] } : plan
writeFileSync(planFile, JSON.stringify(all, null, 1))
const m = memo()
m.daily = [...(m.daily ?? []), { date, kind }]
writeFileSync(MEMORY, JSON.stringify(m, null, 1))
rmSync(join(FM_INSTAGRAM, 'stories'), { recursive: true, force: true })
// This run's items, in publishing order, with their captions.
console.log(JSON.stringify({ dir: `ig/${date}`, kind, items: plan.items }, null, 1))
