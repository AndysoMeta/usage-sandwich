const { app, BrowserWindow, Menu, globalShortcut, ipcMain, screen, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const settingsStore = require('./settings')
const { startUsageServer } = require('./usage-server')
const agent = require('./agent')
const voice = require('./voice')
const { summary } = require('./burger')

const WIDTH = 260
const HEIGHT = 330

let win = null
let settings = null
let reading = null
let sessionId = undefined
let isBusy = false
let showWords = true

const dataDir = () => app.getPath('userData')
const usageFile = () => path.join(dataDir(), 'usage.json')

function send(channel, value) {
  if (!win || win.isDestroyed()) return
  const wc = win.webContents
  if (wc.isLoading()) wc.once('did-finish-load', () => wc.send(channel, value))
  else wc.send(channel, value)
}

function loadReading() {
  try {
    reading = JSON.parse(fs.readFileSync(usageFile(), 'utf8'))
  } catch {
    reading = null
  }
}

function onUsage(next) {
  reading = { ...reading, ...next }
  try {
    fs.writeFileSync(usageFile(), JSON.stringify(reading))
  } catch {}
  send('usage', reading)
}

async function handle(text) {
  send('bubble', `You: ${text}`)
  send('mood', 'thinking')
  const answer = await agent.ask(text, settings, sessionId)
  if (answer.sessionId) sessionId = answer.sessionId
  send('reply', { text: answer.text || 'No answer came back.', speak: settings.speakReplies })
}

async function run(job) {
  if (isBusy) return
  isBusy = true
  try {
    await job()
  } catch (e) {
    send('mood', 'idle')
    send('bubble', e && e.message ? e.message : 'Something went wrong.')
  } finally {
    isBusy = false
  }
}

function talk() {
  return run(async () => {
    send('mood', 'listening')
    send('bubble', 'Listening...')
    const text = await voice.listenOnce()
    if (!text) {
      send('mood', 'idle')
      send('bubble', "I didn't catch that.")
      return
    }
    await handle(text)
  })
}

function usageLines() {
  const now = Date.now()
  const line = (name, w) => {
    if (!w) return null
    const left = Math.max(0, Math.round(100 - w.percentUsed))
    const s = summary({ five: w }, now)
    return `${name}: ${left}% left${s && s.resets ? `, resets in ${s.resets}` : ''}`
  }
  const lines = [line('Session (5 hours)', reading && reading.five), line('Weekly', reading && reading.week)].filter(Boolean)
  return lines.length ? lines : ['No usage yet. Use Claude Code with the burger mod on.']
}

function showMenu() {
  const menu = Menu.buildFromTemplate([
    { label: `Talk (${settings.hotkey})`, click: () => talk() },
    { label: 'Type a message', click: () => send('typing', true) },
    { label: 'Start a new conversation', click: () => { sessionId = undefined; send('bubble', 'Fresh start.') } },
    { type: 'separator' },
    ...usageLines().map(label => ({ label, enabled: false })),
    { type: 'separator' },
    { label: showWords ? 'Hide the words' : 'Show the words', click: () => { showWords = !showWords; send('words', showWords) } },
    { label: 'Open settings file', click: () => shell.openPath(path.join(dataDir(), 'settings.json')) },
    { label: 'Quit', click: () => app.quit() },
  ])
  menu.popup({ window: win })
}

function startPosition() {
  const p = settings.position
  const area = screen.getPrimaryDisplay().workArea
  if (p && screen.getAllDisplays().some(d => {
    const b = d.workArea
    return p.x >= b.x - WIDTH / 2 && p.x < b.x + b.width && p.y >= b.y - HEIGHT / 2 && p.y < b.y + b.height
  })) return p
  return { x: area.x + area.width - WIDTH - 24, y: area.y + area.height - HEIGHT - 24 }
}

function createWindow() {
  const { x, y } = startPosition()
  win = new BrowserWindow({
    x, y, width: WIDTH, height: HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true)
  win.loadFile(path.join(__dirname, 'index.html'))
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', e => e.preventDefault())

  let saveTimer = null
  win.on('moved', () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const [px, py] = win.getPosition()
      settings.position = { x: px, y: py }
      settingsStore.save(dataDir(), settings)
    }, 400)
  })
  win.webContents.on('did-finish-load', () => {
    send('usage', reading)
    send('words', showWords)
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(async () => {
    settings = settingsStore.load(dataDir())
    loadReading()

    ipcMain.handle('position', () => (win ? win.getPosition() : [0, 0]))
    ipcMain.on('move-to', (_, p) => {
      if (win && Number.isFinite(p?.x) && Number.isFinite(p?.y)) win.setPosition(Math.round(p.x), Math.round(p.y))
    })
    ipcMain.on('talk', () => talk())
    ipcMain.on('ask-text', (_, text) => {
      const t = String(text || '').trim().slice(0, 4000)
      if (t) run(() => handle(t))
    })
    ipcMain.on('menu', () => showMenu())

    createWindow()

    try {
      await startUsageServer(onUsage)
    } catch {
      send('bubble', 'Another program is using port 47823, so usage numbers can\'t come in.')
    }

    if (!globalShortcut.register(settings.hotkey, () => talk())) {
      send('bubble', `The hotkey ${settings.hotkey} is taken. Change it in the settings file.`)
    }
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
  app.on('window-all-closed', () => app.quit())
}
