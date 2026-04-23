const { EventEmitter } = require('events')

const emitter = new EventEmitter()

function log(type, message) {
  const entry = { type, message, time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
  emitter.emit('log', entry)
  console.log(`[${entry.time}] [${type}] ${message}`)
}

module.exports = { log, emitter }
