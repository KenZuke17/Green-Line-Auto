const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
app.setName('Green Line Auto Service')
app.setPath('userData', path.join(app.getPath('appData'), 'Green Line Auto Service'))
const isDev = !app.isPackaged
const dbModule = require('./db')

let addWindow = null
let splashWindow = null

const http = require('http')
const DEV_SERVER_PORT = '5173'
const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`

function waitForServer(url, timeout = 10000, interval = 300) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.request(url, { method: 'HEAD' }, (res) => {
        resolve(true)
      })
      req.on('error', (err) => {
        if (Date.now() - start > timeout) return reject(new Error('Timeout waiting for dev server'))
        setTimeout(check, interval)
      })
      req.end()
    }
    check()
  })
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 360,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'))
  } else {
    splashWindow.loadFile(path.join(__dirname, 'renderer', 'splash.html'))
  }

  splashWindow.once('ready-to-show', () => splashWindow.show())
  return splashWindow
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    try {
      await waitForServer(DEV_SERVER_URL)
    } catch (e) {
      // proceed anyway, loadURL will fail if server truly unavailable
    }
    win.loadURL(DEV_SERVER_URL)
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`Renderer console [${level}] ${sourceId}:${line} - ${message}`)
    })
    win.webContents.on('crashed', () => {
      console.error('Renderer process crashed')
    })
    try { win.webContents.openDevTools({ mode: 'detach' }) } catch (e) { /* ignore */ }
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }

  win.once('ready-to-show', () => {
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy()
      win.show()
      win.focus()
    }, 2900)
  })
}

app.whenReady().then(async () => {
  await dbModule.init(app)
  createSplashWindow()
  await createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

ipcMain.handle('open-add-window', (event) => {
  if (addWindow && !addWindow.isDestroyed()) {
    addWindow.focus()
    return
  }

  addWindow = new BrowserWindow({
    width: 600,
    height: 700,
    parent: BrowserWindow.getFocusedWindow(),
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    addWindow.loadURL(`${DEV_SERVER_URL}/#/add`)
    try { addWindow.webContents.openDevTools({ mode: 'detach' }) } catch (e) { /* ignore */ }
  } else {
    addWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
    addWindow.webContents.once('did-finish-load', () => {
      addWindow.webContents.send('open-add')
    })
  }

  addWindow.on('closed', () => { addWindow = null })
})

ipcMain.handle('db:findVehicle', async (event, params) => dbModule.findVehicle(params))
ipcMain.handle('db:createVehicle', async (event, vehicle) => dbModule.createVehicle(vehicle))
ipcMain.handle('db:getServiceHistory', async (event, vehicleId) => dbModule.getServiceHistory(vehicleId))
ipcMain.handle('db:addService', async (event, service) => dbModule.addService(service))
ipcMain.handle('db:getInventory', async () => dbModule.getInventory())
ipcMain.handle('db:updateInventoryQuantity', async (event, { itemId, delta }) => dbModule.updateInventoryQuantity(itemId, delta))
ipcMain.handle('db:createInventoryItem', async (event, item) => dbModule.createInventoryItem(item))
ipcMain.handle('db:getDashboardStats', async () => dbModule.getDashboardStats())
ipcMain.handle('db:getServiceTypeBreakdown', async () => dbModule.getServiceTypeBreakdown())
ipcMain.handle('db:getTodayServices', async () => dbModule.getTodayServices())
ipcMain.handle('db:getAllVehicles', async () => dbModule.getAllVehicles())
ipcMain.handle('db:getAllServices', async () => dbModule.getAllServices())

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
