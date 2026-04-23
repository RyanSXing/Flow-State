const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('settingsAPI', {
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  startSession: (taskDescription) => ipcRenderer.invoke('session:start', taskDescription),
  pauseSession: () => ipcRenderer.invoke('session:pause'),
  resumeSession: () => ipcRenderer.invoke('session:resume'),
  onLogUpdate: (cb) => ipcRenderer.on('session:log-update', (_, events) => cb(events)),
  getCharacters: () => ipcRenderer.invoke('characters:get')
})
