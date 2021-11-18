require("v8-compile-cache");
const needle = require("needle");
const {
  app,
  BrowserWindow,
  nativeImage,
  Tray,
  Menu,
  screen,
  session,
} = require("electron");
const WebSocket = require("ws");
const ws = new WebSocket.Server({
  port: 9421,
});
const Discord = require("discord-rpc");
const rpc = new Discord.Client({ transport: "ipc" });
const path = require("path");
const ElectronPreferences = require("electron-preferences");
const Store = require("electron-store");
let client;

const schema = {
  lastUrl: {
    type: "string",
    format: "url",
    default: "https://chess.com/",
  },
  windowSize: {
    type: "array",
    default: [1200, 900],
  },
};

const store = new Store({ schema });

const image = nativeImage.createFromPath(__dirname + "/icon.png");

image.setTemplateImage(true);

let win = null;
let appIcon = null;
let lastSendUrl = "/";

app.commandLine.appendSwitch("disable-renderer-backgrounding");

const preferences = new ElectronPreferences({
  dataStore: path.resolve(app.getPath("userData"), "preferences.json"),
  defaults: {
    general: {
      persistant_url: true,
    },
    startup: {
      startup_with_os: false,
      startup_hidden: true,
    },
    discord: {
      status_on: true,
    },
    board: {
      show_chessboard_on: false,
      show_chessboard_when: "tray",
      show_chessboard_time: 10,
      show_chessboard_size: 300,
    },
    ad: {
      block: false,
    },
  },
  sections: [
    {
      id: "general",
      label: "General Settings",
      form: {
        groups: [
          {
            label: "General Settings",
            fields: [
              {
                label: "Persistant location",
                key: "persistant_url",
                type: "radio",
                options: [
                  { label: "Open where I left off", value: true },
                  { label: "Start at homepage", value: false },
                ],
                help: "Where to put you when you first open the application",
              },
            ],
          },
        ],
      },
    },
    {
      id: "startup",
      label: "Startup Settings",
      form: {
        groups: [
          {
            label: "Startup Settings",
            fields: [
              {
                label: "On OS Startup",
                key: "startup_type",
                type: "radio",
                options: [
                  { label: "Don't start automatically", value: false },
                  { label: "Start automatically", value: true },
                ],
                help: "If the chess.com desktop application should automatically start when your computer starts up",
              },
            ],
          },
        ],
      },
    },
    {
      id: "discord",
      label: "Discord Settings",
      form: {
        groups: [
          {
            label: "Discord Settings",
            fields: [
              {
                label: "On Discord Presence",
                key: "status_on",
                type: "radio",
                options: [
                  {
                    label: "Show Presence As Playing Chess.com",
                    value: true,
                  },
                  {
                    label: "Do Not Show Presence",
                    value: false,
                  },
                ],
                help: "What to show as status on discord when chess.com is open",
              },
            ],
          },
        ],
      },
    },
    {
      id: "board",
      label: "Chess Board",
      form: {
        groups: [
          {
            label: "Chess Board Settings",
            fields: [
              {
                label: "Chessboard popup",
                key: "show_chessboard_on",
                type: "radio",
                options: [
                  { label: "Show chessboard popup", value: true },
                  { label: "Don't show chessboard popup", value: false },
                ],
                help: "This popup will show the current board state. (May slow down app performance)",
              },
              {
                label: "When to show",
                key: "show_chessboard_when",
                type: "radio",
                options: [
                  { label: "When minimized to tray", value: "tray" },
                  { label: "When out of focus in any way", value: "blur" },
                  { label: "Always show chess board", value: "always" },
                ],
                help: "When to show the popup",
              },
              {
                label: "Popup time (seconds)",
                key: "show_chessboard_time",
                type: "slider",
                min: 1,
                max: 30,
                help: "How long a boardstate popup stays on the screen in seconds",
              },
              {
                label: "Popup size (pixels)",
                key: "show_chessboard_size",
                type: "slider",
                min: 150,
                max: 1200,
                help: "How big the boardstate popup is in pixels",
              },
            ],
          },
        ],
      },
    },
    {
      id: "ad",
      label: "Advertisements",
      form: {
        groups: [
          {
            label: "Advertisement Settings",
            fields: [
              {
                label: "Ad Blocker",
                key: "block",
                type: "radio",
                options: [
                  { label: "Block ads", value: true },
                  { label: "Don't block ads", value: false },
                ],
                help: "Whether to block ads on chess.com or not.",
              },
            ],
          },
        ],
      },
    },
  ],
});

function createWindow() {
  let lastSize = store.get("windowSize");
  win = new BrowserWindow({
    show: !process.argv.includes("--hidden"),
    width: lastSize[0],
    height: lastSize[1],
    webPreferences: {
      nodeIntegration: false,
      backgroundThrottling: false, // better boardstate
      webSecurity: true,
      enableRemoteModule: false,
      contextIsolation: true, // so web contents cant access electrons api
      webgl: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: image,
  });

  // Block ads
  if (preferences.preferences.ad.block) {
    win.webContents.session.webRequest.onBeforeRequest(
      {
        urls: ["https://www.chess.com/bundles/app/js/*"],
      },
      (details, response) => {
        if (details.url.includes("chess-ads")) response({ cancel: true });
        else response(details);
      }
    );
  }

  if (!process.argv.includes("--dev")) {
    win.setMenu(null);
  } else {
    win.webContents.openDevTools();
  }

  if (preferences.preferences.general.persistant_url) {
    // check annoying edge case were you actually leave chess.com XD
    //console.log(new URL(store.get("lastUrl")).origin);
    if (new URL(store.get("lastUrl")).origin != "https://www.chess.com")
      win.loadURL("https://www.chess.com");
    else win.loadURL(store.get("lastUrl"));
  } else win.loadURL("https://www.chess.com/");

  win.on("resized", () => {
    store.set("windowSize", win.getSize());
  });

  // keep contents in same window
  win.webContents.on("new-window", function (e, url) {
    //console.log("new-window " + url);
    e.preventDefault();
    win.loadURL(url);
    lastSendUrl = url;
    if (preferences.preferences.general.persistant_url)
      store.set("lastUrl", url);
    updatePresence(url); //hiddenWindow.webContents.send("navigated", url, win.getTitle());
  });

  win.webContents.on("did-navigate-in-page", function (event, url) {
    //console.log("did-navigate-in-page " + url);
    lastSendUrl = url;
    if (preferences.preferences.general.persistant_url)
      store.set("lastUrl", url);
    updatePresence(url);
  });

  win.webContents.on(
    "did-navigate",
    (event, url, httpResponseCode, httpStatusCode) => {
      //console.log("did-navigate " + url);
      lastSendUrl = url;
      if (preferences.preferences.general.persistant_url)
        store.set("lastUrl", url);
      updatePresence(url); //hiddenWindow.webContents.send("navigated", url, win.getTitle());
    }
  );

  // minimize to tray
  win.on("minimize", function (event) {
    event.preventDefault();
    win.hide();
    //win.webContents.setAudioMuted(true);
    //hiddenWindow.webContents.send("navigated", "https://chess.com/");
    updatePresence("https://chess.com/");
  });
  win.on("close", function (event) {
    event.preventDefault();
    win.hide();
    //win.webContents.setAudioMuted(true);
    //hiddenWindow.webContents.send("navigated", "https://chess.com/");
    updatePresence("https://chess.com/");
  });

  win.on("show", () => {
    //win.webContents.setAudioMuted(false);
    //hiddenWindow.webContents.send("navigated", lastSendUrl);
    updatePresence(lastSendUrl);
  });

  win.on("focus", () => {
    // clear any notification text
    if (appIcon) appIcon.setToolTip("Chess.com");
  });

  // proper quit
  win.on("close", function (event) {
    app.isQuiting = true;
    app.quit();
    process.exit(0);
  });

  //win.on('focus', () => win.flashFrame(false));
}

function createTrayIcon() {
  appIcon = new Tray(image);
  let contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: function () {
        win.show();
      },
    },
    {
      label: "Settings",
      click: function () {
        preferences.show();
      },
    },
    {
      label: "Quit",
      click: function () {
        app.isQuiting = true;
        app.quit();
      },
    },
    {
      label: "Restart",
      click: function () {
        app.relaunch();
        app.exit();
      },
    },
  ]);
  appIcon.setToolTip("Chess.com");
  appIcon.setContextMenu(contextMenu);

  appIcon.on("click", function (e) {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      if (popup) popup.hide();
    }
  });
}

//console.log(path.resolve(app.getPath("userData"), "preferences.json"));
function isInternet() {
  return new Promise(async (resolve, reject) => {
    needle("https://chess.com/")
      .then((req) => {
        resolve(req.statusCode);
      })
      .catch(() => {
        resolve(401);
      });
  });
}
function waitForInternet() {
  return new Promise(async (resolve, reject) => {
    let code = await isInternet();
    if (code >= 400) {
      //console.log("Not Connected " + code);
      const int = setInterval(async () => {
        if (code < 400) {
          resolve();
          clearInterval(int)
          //console.log("Connected to internet " + code);
        } else {
          //console.log("Not Connected " + code);
          code = await isInternet();
        }
      }, 1000 * 5);
    } else {
      //console.log("Connected to internet " + code);
      resolve();
    }
  });
}
app.whenReady().then(async (d) => {
  waitForInternet().then(() => createWindow(d));

  waitForInternet().then(() => createTrayIcon());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    waitForInternet().then(() => createWindow());
  }
});

preferences.on("save", (preferences) => {
  setStartupState(preferences.startup.startup_type);
  //hiddenWindow.webContents.send("preferences", preferences);
  if (popup) popup.close(); // reset popup size
});

function setStartupState(open) {
  app.setLoginItemSettings({
    openAtLogin: open,
    args: ["--hidden"],
  });
}

let popup = null;
let popupTimeout = null;
ws.on("connection", (c) => {
  c.send(`config:${JSON.stringify(preferences.preferences)}`);
  c.on("message", (msg) => {
    const message = msg.toString();
    if (message.startsWith("board-change:")) {
      boardURL = message.replace("board-change:", "");
      //console.log("Update board");
      if (!preferences.preferences.board.show_chessboard_on) return;
      clearTimeout(popupTimeout);
      if (!(preferences.preferences.board.show_chessboard_when == "always")) {
        if (preferences.preferences.board.show_chessboard_when == "tray") {
          if (!win.isMinimized()) return;
        } else if (
          preferences.preferences.board.show_chessboard_when == "blur"
        ) {
          if (win.isFocused()) return;
        }
      }

      if (!popup) {
        let display = screen.getPrimaryDisplay();
        let width = display.bounds.width;
        let height = display.bounds.height;
        let popupSize = preferences.preferences.board.show_chessboard_size;
        popup = new BrowserWindow({
          frame: false,
          show: false,
          width: popupSize,
          height: popupSize,
          x: width - (popupSize + 15),
          y: height - (popupSize + 50),
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: false,
          },
          icon: image,
        });
        popup.loadFile("./boardStatus.html");
        popup.setAlwaysOnTop(true, "screen-saver", 1);
        popup.setSkipTaskbar(true);
        popup.setResizable(false);
      } else popup.showInactive();

      //console.log("Showing popup");

      ws.clients.forEach((c) => c.send(`board-update:${boardURL}`));

      popup.on("close", function (event) {
        popup = null;
      });

      popup.on("focus", () => {
        if (popup) popup.hide();
        win.show();
      });

      popupTimeout = setTimeout(() => {
        if (popup) popup.hide();
      }, preferences.preferences.board.show_chessboard_time * 1000);
    }
  });
});

rpc
  .login({
    clientId: "778330525889724476",
  })
  .then((c) => {
    //console.log("Connected to Discord");
    //console.log(preferences);
    client = c;
  })
  .catch(() => {
    //console.log("Could not connect to Discord");
  });

function updatePresence(url) {
  const pref = preferences._preferences;
  url = new URL(url);
  if (pref.discord.status_on && client) {
    if (url.pathname == "/home") {
      client.setActivity({
        state: "Watching Home Screen",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
    } else if (url.pathname == "/daily-chess-puzzle") {
      client.setActivity({
        state: "Daily Puzzle",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
    } else if (url.pathname.includes("/live")) {
      client.setActivity({
        state: "Playing Live Chess",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/play") {
      client.setActivity({
        state: "Playing Chess",
        details: "Playing Chess",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/play/online") {
      client.setActivity({
        state: "Playing Online Chess",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/play/computer") {
      client.setActivity({
        state: "Playing Computer",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/puzzles/rated") {
      client.setActivity({
        state: "Rated Puzzles",
        details: "Solving Chess Puzzles",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/puzzles/rush") {
      client.setActivity({
        state: "Puzzle Rush",
        details: "Solving Chess Puzzles",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/puzzles/battle") {
      client.setActivity({
        state: "Puzzle Battle",
        details: "Solving Chess Puzzles",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/solo-chess") {
      client.setActivity({
        state: "Solo Chess",
        details: "Solving Chess Puzzles",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname.includes("/drills/practice")) {
      client.setActivity({
        state: "Chess Drills",
        details: "Solving Chess Puzzles",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname.includes("/lessons/")) {
      client.setActivity({
        state: "Learning Chess",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/analysis") {
      client.setActivity({
        state: "Analyzing Chess Match",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/vision") {
      client.setActivity({
        state: "Playing Vision Minigame",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else if (url.pathname == "/explorer") {
      client.setActivity({
        state: "Exploring Chess Positions",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
      return;
    } else {
      client.setActivity({
        state: "Playing Chess.com",
        startTimestamp: new Date(),
        largeImageKey: "logo",
        smallImageKey: "logo1",
        instance: true,
      });
    }
  }
}

process.on("unhandledRejection", () => {});
process.on("uncaughtException", () => {});
process.on("uncaughtExceptionMonitor", () => {});
