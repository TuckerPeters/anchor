// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { registerAnchorScheme, registerProtocol } from './protocol.js'
import { registerIpc } from './ipc.js'
import { seedDemoDocument } from './demo/seed.js'

// Custom scheme must be registered as privileged before the app is ready.
registerAnchorScheme()

let mainWindow = null
const getWindow = () => mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0e1116',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:false is required for the current preload build; contextIsolation +
      // nodeIntegration:false remain the hard security boundary. Enabling sandbox is a
      // hardening follow-up (needs a CommonJS preload output) tracked for the QA pass.
      sandbox: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  // Harden: no new windows, no navigation off our own origin.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const dev = process.env.ELECTRON_RENDERER_URL
    const allowed = dev ? url.startsWith(dev) : url.startsWith('file://') || url.startsWith('anchor://')
    if (!allowed) e.preventDefault()
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' anchor: data: blob:; font-src 'self' data:; " +
            "connect-src 'self' anchor: blob:; worker-src 'self' blob:; object-src 'none'"
          ]
        }
      })
    })
  }

  const root = app.getPath('userData')
  registerProtocol(root)
  seedDemoDocument(root)
  registerIpc(root, getWindow)
  createWindow()

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
