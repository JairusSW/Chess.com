const { app, BrowserWindow, nativeImage } = require('electron')

const image = nativeImage.createFromPath(__dirname + '/logo.png');

image.setTemplateImage(true)

function createWindow () {
  const win = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      webSecurity: false,
      webgl: false
    },
    icon: image
  })

  win.setMenu(null)

  win.loadURL('https://chess.com/')

}

function createHiddenWindow () {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      webgl: false
    },
    icon: image
  })

  win.setMenu(null)

  win.loadFile('./hidden.html')

}

app.whenReady().then((d) => {

  createWindow(d)

  createHiddenWindow(d)

})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})