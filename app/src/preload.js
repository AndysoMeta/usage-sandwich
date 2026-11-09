const { contextBridge, ipcRenderer } = require('electron')

const listen = channel => fn => ipcRenderer.on(channel, (_, value) => fn(value))

contextBridge.exposeInMainWorld('burgerApp', {
  position: () => ipcRenderer.invoke('position'),
  moveTo: (x, y) => ipcRenderer.send('move-to', { x, y }),
  talk: () => ipcRenderer.send('talk'),
  askText: text => ipcRenderer.send('ask-text', text),
  menu: () => ipcRenderer.send('menu'),
  onUsage: listen('usage'),
  onMood: listen('mood'),
  onBubble: listen('bubble'),
  onReply: listen('reply'),
  onTyping: listen('typing'),
  onWords: listen('words'),
})
