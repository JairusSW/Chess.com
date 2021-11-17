const ws = new WebSocket("ws://localhost:9421");

onload = () => {
  let image = document.getElementById("notificationImage");
  ws.onmessage = ({ data: boardURI }) => {
    if (boardURI.startsWith("board-update")) {
      console.log("Updating Remote Board");
      image.src = boardURI.replace("board-update:", "");
    }
  };

  document.body.style = "background-color:rgb(49, 46, 43)";
};
