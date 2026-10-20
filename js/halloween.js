// Halloween look for fullmarkss.com: a moon, bats, a spider, a cobweb and pumpkins
// on the home hero, a witch hat on the logo and a banner. It is on from 20 October
// to 1 November and switches itself off afterwards.
//   ?theme=halloween  previews it on any day
//   ?theme=normal     turns it off for this visit
//   the ✕ on the banner hides it for the rest of the season (remembered on this device)
(() => {
  const d = new Date()
  const year = String(d.getFullYear())
  const asked = new URLSearchParams(location.search).get('theme')
  const season = (d.getMonth() === 9 && d.getDate() >= 20) || (d.getMonth() === 10 && d.getDate() <= 1)
  let hidden = false
  try { hidden = localStorage.getItem('fmHalloweenOff') === year } catch {}
  if (asked === 'normal' || (asked !== 'halloween' && (!season || hidden))) return

  const lang = typeof I18N !== 'undefined' && I18N.on ? I18N.lang : 'en'
  const TEXT = {
    en: ['Spooky season', "Don't let your mocks haunt you.", 'Start revising free →', 'Hide the Halloween theme'],
    sk: ['Strašidelná sezóna', 'Nenechaj sa vystrašiť skúškami.', 'Začni sa učiť zadarmo →', 'Skryť halloweenský vzhľad'],
    es: ['Temporada de miedo', 'Que los exámenes no te den miedo.', 'Empieza gratis →', 'Ocultar el tema de Halloween'],
    ru: ['Жуткий сезон', 'Пусть экзамены тебя не пугают.', 'Начни бесплатно →', 'Скрыть тему Хэллоуина'],
  }[lang] || []
  const [title, line, cta, hideLabel] = TEXT.length ? TEXT : ['Spooky season', "Don't let your mocks haunt you.", 'Start revising free →', 'Hide the Halloween theme']

  const bat = (cls) => `<svg class="spooky-bat ${cls}" viewBox="0 0 64 40" aria-hidden="true"><g class="spooky-wing"><path d="M30 18C22 8 10 6 2 12c6 1 8 5 8 8 4-3 8-2 10 2 3-3 7-2 10 2z"/><path d="M34 18c8-10 20-12 28-6-6 1-8 5-8 8-4-3-8-2-10 2-3-3-7-2-10 2z"/></g><ellipse cx="32" cy="21" rx="4.2" ry="7"/><path d="M28.6 15.5 29.6 10.5l2.4 3 2.4-3 1 5z"/></svg>`
  const pumpkin = (cls) => `<svg class="spooky-pumpkin ${cls}" viewBox="0 0 120 104" aria-hidden="true">
<path d="M58 22c0-8 3-14 9-18l5 4c-5 3-7 8-7 15z" fill="#3F6212"/>
<ellipse cx="38" cy="62" rx="30" ry="38" fill="#EA580C"/><ellipse cx="82" cy="62" rx="30" ry="38" fill="#EA580C"/><ellipse cx="60" cy="62" rx="30" ry="40" fill="#F97316"/>
<path d="M60 24c-6 12-6 64 0 78M60 24c6 12 6 64 0 78" fill="none" stroke="#C2410C" stroke-width="2.5" opacity=".7"/>
<path d="M36 50l12-8 4 14zM84 50l-12-8-4 14z" fill="#FDE68A"/><path d="M34 70q26 18 52 0l-8 6-6-5-6 6-6-6-6 6-6-5z" fill="#FDE68A"/></svg>`
  const web = `<svg class="spooky-web" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.4">
<path d="M0 0L200 70M0 0L170 170M0 0L70 200M0 0L200 10M0 0L10 200"/>
<path d="M40 14Q30 30 14 40M80 28Q62 60 28 80M120 42Q94 94 42 120M160 56Q126 126 56 160"/></g></svg>`
  const spider = `<div class="spooky-spider" aria-hidden="true"><i></i><svg viewBox="0 0 60 52"><g stroke="#0B0716" stroke-width="3" stroke-linecap="round" fill="none">
<path d="M22 22 6 10M22 28 3 28M22 33 7 46M38 22l16-12M38 28h19M38 33l15 13"/></g><ellipse cx="30" cy="27" rx="11" ry="13" fill="#0B0716"/><circle cx="26" cy="22" r="2.6" fill="#F97316"/><circle cx="34" cy="22" r="2.6" fill="#F97316"/></svg></div>`

  const css = `
html.halloween .spooky-bar{position:relative;z-index:60;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:9px 44px 9px 16px;background:linear-gradient(90deg,#1A1033,#3B1D6E 55%,#7C2D12);color:#FDE7C7;font-size:14px;line-height:1.35;text-align:center}
html.halloween .spooky-bar b{color:#FDBA74}
html.halloween .spooky-bar a{color:#fff;font-weight:700;text-decoration:underline;text-underline-offset:3px}
html.halloween .spooky-bar button{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:0;border-radius:50%;background:rgba(255,255,255,.12);color:#fff;font-size:14px;cursor:pointer}
html.halloween .brand{position:relative}
html.halloween .spooky-hat{position:absolute;left:-3px;top:-12px;width:22px;height:18px;pointer-events:none;transform:rotate(-12deg)}
html.halloween #stage .mesh i:nth-child(1){background:#6D28D9}
html.halloween #stage .mesh i:nth-child(2){background:#9A3412;opacity:.7}
html.halloween #stage .mesh i:nth-child(3){background:#EA580C;opacity:.35}
html.halloween #stage .grad{background:linear-gradient(100deg,#F97316 0%,#EA580C 35%,#9333EA 70%,#F97316 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
html.halloween #heroStart{background:linear-gradient(135deg,#F97316,#EA580C);box-shadow:0 12px 28px -10px rgba(234,88,12,.8)}
html.halloween #stage .pill b{background:#F97316;color:#fff}
.spooky-layer{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.spooky-moon{position:absolute;right:6%;top:96px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle at 38% 36%,#FFF7D6 0%,#FDE68A 45%,#F59E0B 100%);box-shadow:0 0 70px 24px rgba(251,191,36,.35),0 0 180px 60px rgba(249,115,22,.18);opacity:.92}
.spooky-moon:before,.spooky-moon:after{content:'';position:absolute;border-radius:50%;background:rgba(217,119,6,.28)}
.spooky-moon:before{width:44px;height:44px;left:52px;top:118px}.spooky-moon:after{width:26px;height:26px;left:140px;top:64px}
.spooky-bat{position:absolute;width:64px;height:40px;fill:#0B0716;filter:drop-shadow(0 0 6px rgba(249,115,22,.25));animation:spookyFly 16s linear infinite}
.spooky-bat .spooky-wing{transform-origin:32px 19px;animation:spookyFlap .32s ease-in-out infinite alternate}
.spooky-bat.b1{top:120px;animation-duration:17s}
.spooky-bat.b2{top:230px;width:46px;height:29px;animation-duration:21s;animation-delay:-7s}
.spooky-bat.b3{top:70px;width:38px;height:24px;animation-duration:25s;animation-delay:-14s}
.spooky-bat.b4{top:330px;width:52px;height:33px;animation-duration:19s;animation-delay:-3s}
@keyframes spookyFly{0%{transform:translate(-120px,0) rotate(4deg)}25%{transform:translate(25vw,-34px) rotate(-6deg)}50%{transform:translate(52vw,18px) rotate(5deg)}75%{transform:translate(78vw,-26px) rotate(-4deg)}100%{transform:translate(calc(100vw + 120px),6px) rotate(3deg)}}
@keyframes spookyFlap{from{transform:scaleY(1)}to{transform:scaleY(.35)}}
.spooky-web{position:absolute;left:0;top:64px;width:190px;height:190px;color:rgba(255,255,255,.22)}
.spooky-spider{position:absolute;right:20%;top:0;width:44px;animation:spookyDrop 5.5s ease-in-out infinite alternate}
.spooky-spider i{position:absolute;left:21px;bottom:36px;width:1.5px;height:600px;background:rgba(255,255,255,.4)}
.spooky-spider svg{position:relative;width:44px;height:38px}
@keyframes spookyDrop{from{transform:translateY(90px)}to{transform:translateY(170px)}}
.spooky-pumpkin{position:absolute;bottom:calc(var(--spooky-bottom,0px) + 12px);width:92px;height:80px;filter:drop-shadow(0 0 18px rgba(249,115,22,.55))}
.spooky-pumpkin.p1{left:3%}.spooky-pumpkin.p2{left:calc(3% + 74px);width:64px;height:56px;bottom:calc(var(--spooky-bottom,0px) + 8px)}
.spooky-pumpkin.p3{right:4%;width:78px;height:68px}
.spooky-pumpkin path[fill="#FDE68A"]{animation:spookyGlow 2.6s ease-in-out infinite alternate}
@keyframes spookyGlow{from{opacity:.7}to{opacity:1}}
@media (max-width:560px){html.halloween .spooky-bar{font-size:13px;gap:8px}html.halloween .spooky-bar .spooky-line{display:none}}
@media (max-width:760px){.spooky-moon{width:120px;height:120px;top:84px;right:-24px;opacity:.75}.spooky-moon:before{width:24px;height:24px;left:28px;top:62px}.spooky-moon:after{width:14px;height:14px;left:74px;top:34px}
.spooky-bat.b3,.spooky-bat.b4,.spooky-web,.spooky-pumpkin.p2{display:none}.spooky-spider{right:12%}.spooky-pumpkin{width:62px;height:54px}.spooky-pumpkin.p3{width:52px;height:46px}}
@media (prefers-reduced-motion:reduce){.spooky-bat,.spooky-bat .spooky-wing,.spooky-spider,.spooky-pumpkin path{animation:none!important}.spooky-bat.b1{transform:translate(40vw,0)}.spooky-bat.b2{transform:translate(65vw,0)}.spooky-bat.b3,.spooky-bat.b4{display:none}}
`

  const apply = () => {
    document.documentElement.classList.add('halloween')
    const style = document.createElement('style')
    style.id = 'spooky-style'
    style.textContent = css
    document.head.appendChild(style)
    const bar = document.createElement('div')
    bar.className = 'spooky-bar'
    bar.innerHTML = `<span>🎃 <b>${title}</b><span class="spooky-line"> · ${line}</span></span><a href="#study">${cta}</a><button type="button" aria-label="${hideLabel}">✕</button>`
    document.body.insertBefore(bar, document.body.firstChild)
    bar.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem('fmHalloweenOff', year) } catch {}
      document.documentElement.classList.remove('halloween')
      for (const el of document.querySelectorAll('.spooky-bar,.spooky-layer,.spooky-hat,#spooky-style')) el.remove()
    })
    const brand = document.querySelector('header .brand')
    if (brand) brand.insertAdjacentHTML('afterbegin', '<svg class="spooky-hat" viewBox="0 0 44 36" aria-hidden="true"><path d="M2 30c10-4 30-4 40 0-10 4-30 4-40 0z" fill="#1E1033"/><path d="M12 29C16 20 18 10 26 2c-1 8 2 18 6 27z" fill="#2E1065"/><path d="M14 25c6-2 12-2 17 0l-1 3c-5-1-10-1-15 0z" fill="#F97316"/></svg>')
    const stage = document.getElementById('stage')
    if (stage) {
      const layer = document.createElement('div')
      layer.className = 'spooky-layer'
      layer.setAttribute('aria-hidden', 'true')
      layer.innerHTML = `<div class="spooky-moon"></div>${web}${spider}${bat('b1')}${bat('b2')}${bat('b3')}${bat('b4')}${pumpkin('p1')}${pumpkin('p2')}${pumpkin('p3')}`
      stage.insertBefore(layer, stage.firstChild)
      // The pumpkins sit just above the stats band at the bottom of the hero.
      const band = stage.querySelector('.statsband')
      const place = () => layer.style.setProperty('--spooky-bottom', `${band ? band.offsetHeight : 0}px`)
      place()
      addEventListener('resize', place)
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply)
  else apply()
})()
