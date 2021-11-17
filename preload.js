// preload for chess.com

const ws = new WebSocket("ws://localhost:9421");
const domtoimage = require("dom-to-image");
console.log("Chess.com Desktop App Launched");
let config;
let loaded = false;
onload = () => {
  loaded = true;
};
ws.onopen = () => {
  ws.onmessage = ({ data }) => {
    if (data.startsWith("config")) {
      config = JSON.parse(data.replace("config:", ""));
      if (config.board.show_chessboard_on) {
        console.log("Enabled Board Watching");
        if (loaded) watchBoard(findBoards());
        else {
          onload = () => {
            watchBoard(findBoards());
            loaded = true;
          };
        }
      }
    }
  };
};

function findBoards() {
  return (
    document.getElementById("board-layout-chessboard") ||
    document.getElementsByTagName("chess-board")[0] ||
    document.getElementById("game-board") ||
    document.getElementById("board-board")
  );
}

function updateBoard(board) {
  console.log("Updating board...");
  //hideCoordinates();
  setTimeout(() => {
    domtoimage
      .toPng(board, {
        style: { left: "0", top: "0", bottom: "0", right: "0" },
      })
      .then(function (dataUrl) {
        //console.log("Updated board.");
        ws.send("board-change:" + dataUrl);
        //showCoordinates();
      });
  }, 350);
  // kill any instance of this as it wont go away when window isnt in focus
  if ((modals = document.getElementsByClassName("board-dialog-component")))
    for (var i = 0; i < modals.length; i++) modals[i].remove();
}

function watchBoard() {
  //console.log("Watching board");
  const obs = new MutationObserver((mutations) => {
    /*if ((Date.now() - lastMove) < 500) {
      //console.log('Moving too fast. Slow down.')
      lastMove = Date.now();
      return;
    }*/
    for (const mut of mutations) {
      if (mut.target.closest(".dragging")) return;

      //console.log(mut.target);
      if (mut.target.className) {
        //console.log(mut.target.className);
        if (
          mut.target.className.baseVal == "arrows" &&
          mut.attributeName !== "style"
        ) {
          //console.log("Arrow Changed.", mut);
          updateBoard(findBoards());
          lastMove = Date.now();
          return;
        } else if (
          mut.target.className.startsWith("highlight") &&
          mut.attributeName !== "style"
        ) {
          //console.log("Square Highlighted.", mut);
          updateBoard(findBoards());
          lastMove = Date.now();
          return;
        } else if (
          mut.target.className.startsWith("piece") &&
          mut.attributeName !== "style"
        ) {
          //console.log("Piece Changed.", mut);
          updateBoard(findBoards());
          lastMove = Date.now();
          return;
        }
      }
    }
  });
  obs.observe(findBoards(), {
    attributes: true,
    //characterData: true,
    childList: true,
    subtree: true,
    //attributeOldValue: true,
    //characterDataOldValue: true
  });
}
