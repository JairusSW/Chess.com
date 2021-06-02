const { ipcRenderer } = require('electron');

var image = document.getElementById('notificationImage');

ipcRenderer.on('board-update', (event, boardURI) => {
    image.src = boardURI;
});

document.body.style = "background-color:rgb(49, 46, 43)";