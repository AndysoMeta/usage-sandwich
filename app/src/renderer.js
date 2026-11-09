const api = window.burgerApp
const { burgerSvg, summary } = window.Burger

const burgerEl = document.getElementById('burger')
const bubbleEl = document.getElementById('bubble')
const labelEl = document.getElementById('label')
const askEl = document.getElementById('ask')

let reading = null
let mood = 'idle'
let mouthOpen = false
let mouthTimer = null
let bubbleTimer = null

function draw() {
  const s = summary(reading, Date.now())
  const pct = s ? s.percentUsed : 0
  burgerEl.innerHTML = burgerSvg(pct, mood, mouthOpen)
  burgerEl.className = mood
  labelEl.textContent = s
    ? `${s.left}% left (${s.name})${s.resets ? `, resets in ${s.resets}` : ''}`
    : 'Waiting for usage from Claude Code'
}

function bubble(text, staysMs = 20000) {
  clearTimeout(bubbleTimer)
  bubbleEl.textContent = text || ''
  if (text && staysMs) bubbleTimer = setTimeout(() => (bubbleEl.textContent = ''), staysMs)
}

function setMood(next) {
  mood = next
  if (mood !== 'talking') {
    clearInterval(mouthTimer)
    mouthTimer = null
    mouthOpen = false
  }
  draw()
}

function speak(text) {
  if (!('speechSynthesis' in window)) return setMood('idle')
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.onstart = () => {
    setMood('talking')
    mouthTimer = setInterval(() => { mouthOpen = !mouthOpen; draw() }, 160)
  }
  u.onend = u.onerror = () => setMood('idle')
  speechSynthesis.speak(u)
}

// Drag to move; a click (no drag) talks; a double-click types; right-click opens the menu.
let press = null
let clickTimer = null
burgerEl.addEventListener('pointerdown', async e => {
  if (e.button !== 0) return
  burgerEl.setPointerCapture(e.pointerId)
  const [wx, wy] = await api.position()
  press = { sx: e.screenX, sy: e.screenY, wx, wy, moved: false }
})
burgerEl.addEventListener('pointermove', e => {
  if (!press) return
  const dx = e.screenX - press.sx
  const dy = e.screenY - press.sy
  if (!press.moved && Math.hypot(dx, dy) < 4) return
  press.moved = true
  api.moveTo(press.wx + dx, press.wy + dy)
})
burgerEl.addEventListener('pointerup', () => {
  const wasClick = press && !press.moved
  press = null
  if (!wasClick) return
  clearTimeout(clickTimer)
  clickTimer = setTimeout(() => {
    speechSynthesis.cancel()
    api.talk()
  }, 260)
})
burgerEl.addEventListener('dblclick', () => {
  clearTimeout(clickTimer)
  askEl.classList.add('on')
  askEl.focus()
})
window.addEventListener('contextmenu', e => {
  e.preventDefault()
  api.menu()
})
askEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') askEl.classList.remove('on')
  if (e.key !== 'Enter') return
  const text = askEl.value.trim()
  askEl.value = ''
  askEl.classList.remove('on')
  if (text) api.askText(text)
})

api.onUsage(r => { reading = r; draw() })
api.onMood(m => setMood(m))
api.onBubble(t => bubble(t))
api.onReply(({ text, speak: shouldSpeak }) => {
  bubble(text, 45000)
  if (shouldSpeak) speak(text)
  else setMood('idle')
})
api.onTyping(() => { askEl.classList.add('on'); askEl.focus() })
api.onWords(show => document.body.classList.toggle('hide-words', !show))

setInterval(draw, 60000)
draw()
