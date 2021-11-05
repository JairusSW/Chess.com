// preload for chess.com

const { ipcRenderer } = require("electron");
const domtoimage = require("dom-to-image");
console.log("Chess.com Desktop App Launched");
let watching = true; //AnimationType

function findBoards() {
  return (
    document.getElementsByTagName("chess-board")[0] ||
    document.getElementById("game-board") ||
    document.getElementById("board-board")
  );
}
let firstTime = true;
let coordinates = null;
let lastMove = Date.now();

function hideCoordinates() {
  const node = document.getElementsByClassName("coordinates outside")[0];
  coordinates = node;
  if (node) node.remove();
}

function showCoordinates() {
  findBoards().append(coordinates);
}

function updateBoard(board) {
  console.log("Updating board...");
  //hideCoordinates();
    domtoimage
      .toPng(board, {
        style: { left: "0", top: "0", bottom: "0", right: "0" },
      })
      .then(function (dataUrl) {
        console.log("Updated board.");
        ipcRenderer.send("board-change", dataUrl);
        //showCoordinates();
      });
  // kill any instance of this as it wont go away when window isnt in focus
  if ((modals = document.getElementsByClassName("board-dialog-component")))
    for (var i = 0; i < modals.length; i++) modals[i].remove();
}

function watchBoard() {
  console.log("Watching board");
  const obs = new MutationObserver((mutations) => {
    /*if ((Date.now() - lastMove) < 500) {
      console.log('Moving too fast. Slow down.')
      lastMove = Date.now();
      return;
    }*/
    for (const mut of mutations) {
      if (mut.target.closest(".dragging")) return;
      else if (mut.target.className) {
        if (mut.target.className.startsWith("highlight")) {
          console.log("Square Highlighted.");
          updateBoard(findBoards());
          lastMove = Date.now();
          return;
        } else if (mut.target.className.baseVal == "arrows") {
          console.log("Arrow Changed.");
          updateBoard(findBoards());
          lastMove = Date.now();
          return;
        } else if (
          mut.target.className.startsWith("piece") &&
          mut.attributeName !== "style"
        ) {
          console.log("Piece Changed.", mut);
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
onload = () => {
  console.log(findBoards());
  watchBoard(findBoards());
};
