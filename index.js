const { app, BrowserWindow, nativeImage, Tray, Menu, ipcMain, screen } = require('electron')
const path = require('path');
const ElectronPreferences = require('electron-preferences');
const Store = require('electron-store');

const schema = {
	lastUrl: {
    type: 'string',
    format: 'url',
    default: 'https://chess.com'
  },
  windowSize: {
    type: 'array',
    default: [1200, 900]
  }
}
const store = new Store({schema})

const image = nativeImage.createFromPath(__dirname + '/icon.png');

image.setTemplateImage(true)

let hiddenWindow = null;
let win = null;
let lastSendUrl = "/";

app.commandLine.appendSwitch('disable-renderer-backgrounding')

function createWindow () {
  var lastSize = store.get('windowSize');
  win = new BrowserWindow({
    show: !process.argv.includes('--hidden'),
    width: lastSize[0],
    height: lastSize[1],
    webPreferences: {
      nodeIntegration: preferences.preferences.notifications.show_chessboard_on,
      backgroundThrottling: false, // better notifications
      webSecurity: true,
      enableRemoteModule: false,
      contextIsolation: true, // so web contents cant access electrons api
      webgl: false,
      preload: preferences.preferences.notifications.show_chessboard_on ? path.join(__dirname, 'preload.js') : null,
    },
    icon: image
  })

  if (!process.argv.includes('--dev')) win.setMenu(null)

  if (preferences.preferences.general.persistant_url) {
    // check annoying edge case were you actually leave chess.com XD
    console.log((new URL(store.get('lastUrl'))).origin)
    if ((new URL(store.get('lastUrl'))).origin != 'https://www.chess.com') win.loadURL('https://www.chess.com')
    else win.loadURL(store.get('lastUrl'))
  } else win.loadURL('https://www.chess.com/')

  win.on('resized', () => {
    store.set('windowSize', win.getSize())
  });

  // keep contents in same window
  win.webContents.on('new-window', function(e, url) {
    e.preventDefault();
    win.loadURL(url);
    lastSendUrl = url;
    if (preferences.preferences.general.persistant_url) store.set('lastUrl', url)
    if (hiddenWindow) hiddenWindow.webContents.send('navigated', url, win.getTitle())
  });

  win.webContents.on('did-navigate-in-page', function (event, url) {
    lastSendUrl = url;
    if (preferences.preferences.general.persistant_url) store.set('lastUrl', url)
    if (hiddenWindow) hiddenWindow.webContents.send('navigated', url, win.getTitle())
    win.webContents.send('refresh-watchers');
  });

  win.webContents.on('did-navigate', (event, url, httpResponseCode, httpStatusCode) => {
    lastSendUrl = url;
    if (preferences.preferences.general.persistant_url) store.set('lastUrl', url)
    if (hiddenWindow) hiddenWindow.webContents.send('navigated', url, win.getTitle())
  });

  // minimize to tray
  win.on('minimize',function(event){
    event.preventDefault();
    win.hide();
    //win.webContents.setAudioMuted(true);
    hiddenWindow.webContents.send('navigated', "https://chess.com/")
    win.webContents.send('minimized');
  });

  win.on('show', () => {
    //win.webContents.setAudioMuted(false);
    hiddenWindow.webContents.send('navigated', lastSendUrl)
    win.webContents.send('visible');
  })

  win.on('focus', () => {
    // clear any notification text
    appIcon.setToolTip('Chess.com');
  });

  // proper quit
  win.on('close',function(event){
    app.isQuiting = true;
    app.quit();
  });

  //win.on('focus', () => win.flashFrame(false));

}

function createHiddenWindow () {
  hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      webgl: false
    },
    icon: image
  })
  //hiddenWindow.setMenu(null)

  hiddenWindow.loadFile('./hidden.html')

  hiddenWindow.webContents.on('did-finish-load', ()=>{
    hiddenWindow.webContents.send('preferences', preferences.preferences)
  })

}

function createTrayIcon() {
  appIcon = new Tray(image);
  var contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show', 
      click:  function(){
        win.show();
      } 
    },
    { 
      label: 'Settings', 
      click:  function(){
        preferences.show();
      } 
    },
    { 
      label: 'Quit', 
      click:  function(){
        app.isQuiting = true;
        app.quit();
      } 
    }
  ]);
  appIcon.setToolTip('Chess.com');
  appIcon.setContextMenu(contextMenu);

  appIcon.on('click', function(e){
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
    }
  });

}

ipcMain.on('notification', (title, options) => {
  if (win.isFocused()) return;
  appIcon.setToolTip(`•  ${options.name}`);
});

const preferences = new ElectronPreferences({
  'dataStore': path.resolve(app.getPath('userData'), 'preferences.json'),
  'defaults': {
    'general': {
      'persistant_url': true,
    },
    'startup': {
        'startup_with_os': false,
        'startup_hidden': true,
    },
    'discord': {
        'status_on': [
          'live',
          'playing',
          'puzzles',
          'lessons'
        ]
    },
    'notifications': {
      'show_chessboard_on': false,
      'show_chessboard_when': 'tray',
      'show_chessboard_time': 10,
      'show_chessboard_size': 300,
    }
  },
  'sections':[
    {
      'id': 'general',
      'label': 'General Settings',
      'form': {
          'groups': [
              {
                  'label': 'General Settings',
                  'fields': [
                    {
                        'label': "Persistant location",
                        'key': 'persistant_url',
                        'type': 'radio',
                        'options': [
                          {'label': "Open where I left off", 'value': true},
                          {'label': 'Start at homepage', 'value': false},
                        ],
                        'help': 'Where to put you when you first open the application'
                    }
                ]
              }
          ]      
      }
    },
      {
        'id': 'startup',
        'label': 'Startup Settings',
        'form': {
            'groups': [
                {
                    'label': 'Startup Settings',
                    'fields': [
                      {
                          'label': "On OS Startup",
                          'key': 'startup_type',
                          'type': 'radio',
                          'options': [
                            {'label': "Don't start automatically", 'value': false},
                            {'label': 'Start automatically', 'value': true},
                          ],
                          'help': 'If the chess.com desktop application should automatically start when your computer starts up'
                      }
                  ]
                }
            ]      
        }
      },
    {
      'id': 'discord',
      'label': 'Discord Settings',
      'form': {
          'groups': [
              {
                  'label': 'Discord Settings',
                  'fields': [
                      {
                          'label': "When to show chess.com status",
                          'key': 'status_on',
                          'type': 'checkbox',
                          'options': [
                              {'label': 'Watching Live', 'value': 'live'},
                              {'label': 'Playing Chess', 'value': 'playing'},
                              {'label': 'Solving Puzzles', 'value': 'puzzles'},
                              {'label': 'Watching Lessons', 'value': 'lessons'},
                          ],
                          'help': 'What to publicly show on discord'
                      }
                  ]
              } 
          ]
      }
    },
    {
      'id': 'notifications',
      'label': 'Notifications',
      'form': {
          'groups': [
              {
                  'label': 'Notification Settings',
                      'fields': [
                      {
                          'label': "Chessboard notifications (requires program restart to take effect)",
                          'key': 'show_chessboard_on',
                          'type': 'radio',
                          'options': [
                              {'label': 'Show chessboard notifications', 'value': true},
                              {'label': 'Dont show chessboard notifications', 'value': false},
                          ],
                          'help': 'These notifications will show the current board state. To get this information we need to inject code into the webpage, use at your own risk'
                      },
                      {
                        'label': "When to show",
                        'key': 'show_chessboard_when',
                        'type': 'radio',
                        'options': [
                            {'label': 'When minimized to tray', 'value': 'tray'},
                            {'label': 'When out of focus in any way', 'value': 'blur'},
                        ],
                        'help': 'When to show the notification'
                      },
                      {
                        'label': "Notification time (seconds)",
                        'key': 'show_chessboard_time',
                        'type': 'slider',
                        'min': 1,
                        'max': 30,
                        'help': 'How long a boardstate notifcation stays on the screen in seconds'
                      },
                      {
                        'label': "Notification size (pixels)",
                        'key': 'show_chessboard_size',
                        'type': 'slider',
                        'min': 150,
                        'max': 1200,
                        'help': 'How big the boardstate notification is in pixels'
                      }
                  ]
              } 
          ]
      }
    }
  ]
});

app.whenReady().then((d) => {

  createWindow(d)

  createTrayIcon();

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

preferences.on('save', (preferences) => {
  setStartupState(preferences.startup.startup_type)
  hiddenWindow.webContents.send('preferences', preferences)
  if (popup) popup.close(); // reset popup size

});

function setStartupState(open) {
  app.setLoginItemSettings({
    openAtLogin: open,
    args: ['--hidden'],
  })
}

let popup = null;
let popupTimeout = null;
ipcMain.on('board-change', (event, html) => {

  clearTimeout(popupTimeout)
  
  if (preferences.preferences.notifications.show_chessboard_when == 'tray') {
    if (!win.isMinimized()) return;
  } else if (preferences.preferences.notifications.show_chessboard_when == 'blur') {
    if (win.isFocused()) return;
  }

  if (!popup) {
    let display = screen.getPrimaryDisplay();
    let width = display.bounds.width;
    let height = display.bounds.height;
    let popupSize = preferences.preferences.notifications.show_chessboard_size;
    popup = new BrowserWindow({
      frame: false,
      show: false,
      width: popupSize,
      height: popupSize,
      x: width - (popupSize + 15),
      y: height - (popupSize + 50),
      webPreferences: {
        nodeIntegration: true,
        webSecurity: false,
        webgl: false,
      },
      icon: image
    })
    popup.loadFile('./boardNotification.html')
    popup.setAlwaysOnTop(true, "screen-saver", 1);
    popup.setSkipTaskbar(true);
    //popup.setResizable(false)
  } else popup.showInactive();

  popup.once('close',function(event){
    popup = null;
  });
  
  popup.once('focus', () => {
    popup.hide();
    win.show();
  });

  popup.webContents.send('board-update', html);

  popupTimeout = setTimeout(() => {
    if (popup) popup.hide();
  }, preferences.preferences.notifications.show_chessboard_time * 1000);
  
});