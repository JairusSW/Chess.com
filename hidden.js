'use strict';

const Discord = require('discord-rpc');
const EventEmitter = require('events');
const { ipcRenderer } = require('electron');

function makeClient(clientId) {
  const rpc = new Discord.Client({ transport: 'ipc' });

  let connected = false;
  let activityCache = null;

  const instance = new class RP extends EventEmitter {
    updatePresence(d) {
      if (connected) {
        rpc.setActivity(d).catch((e) => this.emit('error', e));
      } else {
        activityCache = d;
      }
    }

    clearPresence() {
      if (connected) rpc.clearActivity();
    }

    reply(user, response) {
      const handle = (e) => this.emit('error', e);
      switch (response) {
        case 'YES':
          rpc.sendJoinInvite(user).catch(handle);
          break;
        case 'NO':
        case 'IGNORE':
          rpc.closeJoinRequest(user).catch(handle);
          break;
        default:
          throw new RangeError('unknown response');
      }
    }

    disconnect() {
      rpc.destroy().catch((e) => this.emit('error', e));
    }
  }();

  rpc.on('error', (e) => instance.emit('error', e));

  rpc.login({ clientId })
    .then(() => {
      instance.emit('connected');
      connected = true;

      rpc.subscribe('ACTIVITY_JOIN', ({ secret }) => {
        instance.emit('join', secret);
      });
      rpc.subscribe('ACTIVITY_SPECTATE', ({ secret }) => {
        instance.emit('spectate', secret);
      });
      rpc.subscribe('ACTIVITY_JOIN_REQUEST', (user) => {
        instance.emit('joinRequest', user);
      });

      if (activityCache) {
        rpc.setActivity(activityCache).catch((e) => instance.emit('error', e));
        activityCache = null;
      }
    })
    .catch((e) => instance.emit('error', e));

  return instance;
}

const client = makeClient('778330525889724476')

let prefs = null;
ipcRenderer.on('preferences', (event, preferences) => {
  prefs = preferences;
});

// When chess.com has navigated
ipcRenderer.on('navigated', (event, url, title) => {
  url = new URL(url);

  // We can parse the url to determine the current users state for discord
  if (prefs.discord.status_on.includes('live') && url.pathname.includes("/live")) {client.updatePresence({state: 'Watching Live Chess', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
  
  if (prefs.discord.status_on.includes('playing')) {
    if      (url.pathname == "/play") {client.updatePresence({state: 'Playing Chess', details: 'Playing Chess', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == "/play/online") {client.updatePresence({state: 'Playing Online Chess', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == "/play/computer") {client.updatePresence({state: 'Playing AI Chess', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
  }
  
  if (prefs.discord.status_on.includes('puzzles')) {
    if      (url.pathname == "/puzzles/rated") {client.updatePresence({state: 'Rated Puzzles', details: 'Solving Chess Puzzles', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == "/puzzles/rush") {client.updatePresence({state: 'Puzzle Rush', details: 'Solving Chess Puzzles', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == "/puzzles/battle") {client.updatePresence({state: 'Puzzle Battle', details: 'Solving Chess Puzzles', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == "/solo-chess") {client.updatePresence({state: 'Solo Chess', details: 'Solving Chess Puzzles', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname.includes("/drills/practice")) {client.updatePresence({state: 'Chess Drills', details: 'Solving Chess Puzzles', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
  }

  if (prefs.discord.status_on.includes('lessons')) {
    if      (url.pathname.includes("/lessons/")) {client.updatePresence({state: 'Learning Chess', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == '/analysis') {client.updatePresence({state: 'Analyzing Chess Match', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == '/vision') {client.updatePresence({state: 'Playing Vision Minigame', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
    else if (url.pathname == '/explorer') {client.updatePresence({state: 'Exploring Chess Positions', startTimestamp: new Date(), largeImageKey: 'logo', smallImageKey: 'logo1', instance: true});return}
  }

  client.clearPresence()

})

/*client.updatePresence({
  state: 'Playing Chess',
  details: 'Chess.com',
  startTimestamp: 0,
  endTimestamp: 0,
  largeImageKey: 'logo',
  smallImageKey: 'logo1',
  instance: true,
});*/