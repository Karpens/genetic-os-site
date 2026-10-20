// The Full Marks look for Instagram, shared by fm-insta.mjs and fm-profil.mjs:
// the site's colours and fonts (Plus Jakarta Sans + Inter, from ./fonts so
// pictures look the same offline), the app's green mascot, subject icons and the logo.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const C = {
  indigo: '#4361EE', violet: '#7C3AED', ink: '#1B2236', muted: '#5D667A', line: '#E3E7F0',
  paper: '#F7F8FC', white: '#FFFFFF', night: '#141A2C', night2: '#1C2439', nightInk: '#E9EDF6', nightMuted: '#A3ACC0',
  ok: '#16A34A', okSoft: '#E7F7ED', gold: '#FBBF24', pink: '#EC4899',
}
export const BRAND_BG = `radial-gradient(520px 520px at 100% 0%,rgba(255,255,255,.14),transparent 70%),radial-gradient(460px 460px at 0% 100%,rgba(255,255,255,.10),transparent 70%),linear-gradient(135deg,${C.indigo},${C.violet})`

export const SUBJECT_COLOUR = {
  biology: '#16A34A', chemistry: '#F59E0B', physics: '#0EA5E9', maths: '#EF4444', further: '#D946EF',
  computing: '#8B5CF6', geography: '#14B8A6', psychology: '#EC4899', economics: '#F97316', business: '#2563EB',
}

// ---------- fonts ----------
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF'
const GREEK = 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF'
const FACES = [
  ...[700, 800].flatMap((w) => [['Plus Jakarta Sans', w, 'latin', LATIN], ['Plus Jakarta Sans', w, 'latin-ext', LATIN_EXT]]),
  ...[400, 500, 600, 700].flatMap((w) => [['Inter', w, 'latin', LATIN], ['Inter', w, 'latin-ext', LATIN_EXT], ['Inter', w, 'greek', GREEK]]),
]
let fontCache
export function fontCss() {
  if (fontCache) return fontCache
  const dir = join(here, 'fonts')
  const file = (fam, w, sub) => join(dir, `${fam === 'Inter' ? 'inter' : 'plus-jakarta-sans'}-${sub}-${w}-normal.woff2`)
  if (FACES.every(([f, w, s]) => existsSync(file(f, w, s)))) {
    fontCache = `<style>${FACES.map(([f, w, s, r]) => `@font-face{font-family:'${f}';font-weight:${w};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${readFileSync(file(f, w, s)).toString('base64')}) format('woff2');unicode-range:${r}}`).join('')}</style>`
  } else {
    fontCache = '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=block" rel="stylesheet">'
  }
  return fontCache
}

// ---------- the mascot (the app icon's green character) ----------
// expr: happy | think | wow | cheer
export function mascot(expr = 'happy', size = 300, id = 'm', hat = 'cap') {
  const dark = '#1C1A17'
  const pupil = { happy: [10, 12], think: [18, -16], wow: [0, 2], cheer: [0, 0] }[expr] ?? [10, 12]
  const eyes = expr === 'cheer'
    ? `<path d="M396 512q40-46 80 0M548 512q40-46 80 0" fill="none" stroke="${dark}" stroke-width="22" stroke-linecap="round"/>`
    : `<circle cx="436" cy="498" r="58" fill="#fff"/><circle cx="588" cy="498" r="58" fill="#fff"/>
<circle cx="${436 + pupil[0]}" cy="${498 + pupil[1]}" r="${expr === 'wow' ? 27 : 31}" fill="${dark}"/><circle cx="${588 + pupil[0]}" cy="${498 + pupil[1]}" r="${expr === 'wow' ? 27 : 31}" fill="${dark}"/>
<circle cx="${447 + pupil[0]}" cy="${485 + pupil[1]}" r="11" fill="#fff"/><circle cx="${599 + pupil[0]}" cy="${485 + pupil[1]}" r="11" fill="#fff"/>`
  const mouth = {
    happy: `<path d="M445 594Q512 652 578 594" fill="none" stroke="${dark}" stroke-width="22" stroke-linecap="round"/>`,
    think: `<path d="M478 614Q500 600 548 606" fill="none" stroke="${dark}" stroke-width="20" stroke-linecap="round"/>`,
    wow: `<ellipse cx="512" cy="614" rx="25" ry="31" fill="${dark}"/>`,
    cheer: `<path d="M432 586Q512 690 592 586Z" fill="${dark}"/><path d="M470 628Q512 664 554 628Q512 612 470 628Z" fill="#F07C8E"/>`,
  }[expr] ?? ''
  const star = (x, y, r, c = C.gold) => `<path d="M${x} ${y - r}C${x + r * 0.12} ${y - r * 0.12} ${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y}C${x + r * 0.12} ${y + r * 0.12} ${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r}C${x - r * 0.12} ${y + r * 0.12} ${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y}C${x - r * 0.12} ${y - r * 0.12} ${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r}Z" fill="${c}"/>`
  const extra = expr === 'cheer' ? star(800, 300, 52) + star(232, 380, 30) + star(770, 470, 24, '#fff')
    : expr === 'think' ? `<circle cx="770" cy="236" r="70" fill="#fff"/><circle cx="716" cy="330" r="16" fill="#fff"/><circle cx="696" cy="370" r="9" fill="#fff"/><text x="770" y="268" text-anchor="middle" font-family="Plus Jakarta Sans" font-weight="800" font-size="96" fill="${C.indigo}">?</text>`
    : expr === 'wow' ? star(800, 300, 40) + star(240, 330, 26) : ''
  return `<svg width="${size}" height="${size}" viewBox="190 150 660 660" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
<defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3DD68C"/><stop offset="1" stop-color="#0E8A4F"/></linearGradient>
<radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="512" cy="792" rx="230" ry="26" fill="url(#${id}s)"/>
<ellipse cx="430" cy="757" rx="56" ry="28" fill="#0B6E3F"/><ellipse cx="594" cy="757" rx="56" ry="28" fill="#0B6E3F"/>
<ellipse cx="512" cy="545" rx="225" ry="220" fill="url(#${id}b)"/>
<ellipse cx="430" cy="412" rx="52" ry="24" transform="rotate(-28 430 412)" fill="#fff" opacity=".24"/>
${eyes}<ellipse cx="374" cy="581" rx="33" ry="20" fill="#EC93A8"/><ellipse cx="650" cy="581" rx="33" ry="20" fill="#EC93A8"/>${mouth}
${hat === 'witch'
    ? `<ellipse cx="512" cy="352" rx="236" ry="36" fill="#1E1033"/><path d="M392 348C424 262 466 192 500 150C522 122 566 112 610 134C576 142 556 164 552 196C562 252 592 304 628 348Z" fill="#2E1065"/><path d="M402 326C470 312 560 312 622 326L630 352C560 340 470 340 394 352Z" fill="#F97316"/><rect x="494" y="322" width="36" height="30" rx="5" fill="none" stroke="#FBBF24" stroke-width="7"/>`
    : `<path d="M410 335H614V380A102 22 0 0 1 410 380Z" fill="#2A2620"/><path d="M313 305L512 244L711 305L512 366Z" fill="${dark}"/>
<path d="M512 305L665 328V405" fill="none" stroke="#F4C04E" stroke-width="10" stroke-linejoin="round"/><circle cx="512" cy="305" r="14" fill="#F4C04E"/><path d="M650 403H680L690 448H640Z" fill="#F4C04E"/>`}
${extra}</svg>`
}

// ---------- logo ----------
export const logoMark = (size = 64, ring = '#fff', tick = C.indigo) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" style="display:block;flex:none"><circle cx="32" cy="32" r="32" fill="${ring}"/><path d="M19 33.5l8.5 8.5L45.5 23.5" fill="none" stroke="${tick}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
export const logo = (onDark = true, size = 56) => `<div style="display:flex;align-items:center;gap:${Math.round(size * 0.3)}px;font-family:'Plus Jakarta Sans';font-weight:800;font-size:${Math.round(size * 0.62)}px;letter-spacing:-.02em;color:${onDark ? '#fff' : C.ink}">${onDark ? logoMark(size) : logoMark(size, C.indigo, '#fff')}Full Marks</div>`

// ---------- icons (24×24, drawn with currentColor) ----------
const I = {
  biology: '<path d="M7 2.5c0 4.5 10 4.5 10 9.5s-10 5-10 9.5M17 2.5c0 4.5-10 4.5-10 9.5s10 5 10 9.5M8.2 4.3h7.6M8 12h8M8.2 19.7h7.6"/>',
  chemistry: '<path d="M9 2.5h6M10 2.5v6.2L4.6 18.4a2 2 0 0 0 1.8 3.1h11.2a2 2 0 0 0 1.8-3.1L14 8.7V2.5M7 15.5h10"/>',
  physics: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/>',
  maths: '<path d="M6.5 3.5v7M3 7h7M14 7h7M4 14.5l5 5M9 14.5l-5 5M14 17h7"/><circle cx="17.5" cy="14" r=".9" fill="currentColor"/><circle cx="17.5" cy="20" r=".9" fill="currentColor"/>',
  further: '<path d="M14.5 3c-2.2 0-2.7 1.6-3 4l-1.2 10c-.3 2.4-.8 4-3 4M17 9.5v6M14 12.5h6"/>',
  computing: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  geography: '<circle cx="12" cy="12" r="9.5"/><ellipse cx="12" cy="12" rx="4.2" ry="9.5"/><path d="M2.5 12h19M4.2 7h15.6M4.2 17h15.6"/>',
  psychology: '<path d="M12 5a3 3 0 0 0-5.6 1.2A3 3 0 0 0 4 11a3 3 0 0 0 .9 4.6A3 3 0 0 0 9 20a3 3 0 0 0 3-1.6M12 5a3 3 0 0 1 5.6 1.2A3 3 0 0 1 20 11a3 3 0 0 1-.9 4.6A3 3 0 0 1 15 20a3 3 0 0 1-3-1.6M12 5v13.4M8.5 10.5a2 2 0 0 1 2 2M15.5 10.5a2 2 0 0 0-2 2"/>',
  economics: '<path d="M3 3v18h18M7 15.5l4-4.5 3 3 5.5-6.5M15.5 7.5h4v4"/>',
  business: '<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M9 7.5V5.6A1.6 1.6 0 0 1 10.6 4h2.8A1.6 1.6 0 0 1 15 5.6v1.9M3 13h18"/>',
  bulb: '<path d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.4 1 2.2V16h6v-.2c0-.8.4-1.6 1-2.2a6.5 6.5 0 0 0-4-11.1z"/>',
  bookmark: '<path d="M6.5 3.5h11v17.5L12 16.8 6.5 21z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4a1.5 1.5 0 0 1 3 0v6.5M14 10.5V5.5a1.5 1.5 0 0 1 3 0V13M17 11a1.5 1.5 0 0 1 3 0v3a7 7 0 0 1-7 7h-1.5a6 6 0 0 1-4.6-2.2L4 15.5a1.6 1.6 0 0 1 2.4-2.1L8 15"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  quiz: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4"/><circle cx="12" cy="17.6" r=".9" fill="currentColor"/>',
  gift: '<rect x="3" y="8" width="18" height="4.5" rx="1"/><path d="M5 12.5V21h14v-8.5M12 8v13M12 8C10 4 6.5 4.5 7 7c.3 1 2.5 1 5 1zM12 8c2-4 5.5-3.5 5-1-.3 1-2.5 1-5 1z"/>',
  target: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
}
export const icon = (name, size = 48, colour = 'currentColor', width = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none;color:${colour}">${I[name] ?? I.star}</svg>`

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Shrinks every [data-fit] text in a box until the box stops overflowing.
export const FIT_SCRIPT = `<script>
function fitAll(){for(const box of document.querySelectorAll('[data-box]')){const fits=[...box.querySelectorAll('[data-fit]')];let n=0;
while(box.scrollHeight>box.clientHeight+1&&n++<60)for(const el of fits){const f=parseFloat(getComputedStyle(el).fontSize);el.style.fontSize=(f*.96)+'px'}}}
</script>`

export async function shoot(tab, html, path, { width = 1080, height = 1350 } = {}) {
  await tab.setViewportSize({ width, height })
  await tab.setContent(html, { waitUntil: 'load' }).catch(() => {})
  await tab.evaluate(() => document.fonts.ready)
  await tab.evaluate(() => typeof fitAll === 'function' && fitAll())
  await tab.screenshot({ path })
}
