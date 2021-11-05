const { ipcRenderer } = require("electron");

onload = () => {
  let image = document.getElementById("notificationImage");

  ipcRenderer.on("board-update", (event, boardURI) => {
    console.log('Updating Remote Board')
    image.src = boardURI;
  });

  document.body.style = "background-color:rgb(49, 46, 43)";
}