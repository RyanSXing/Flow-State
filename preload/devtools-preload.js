const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('devtoolsAPI', {
  onLog: (cb) => ipcRenderer.on('devtools:log', (_, entry) => cb(entry)),
  clearLog: () => ipcRenderer.send('devtools:clear')
})
