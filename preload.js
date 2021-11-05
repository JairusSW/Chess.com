// preload for chess.com

const { ipcRenderer } = require("electron");
const domtoimage = require("dom-to-image");

document.__defineGetter__("visibilityState", () => "visible");
document.__defineGetter__("hidden", () => false);

console.log("Chess.com Desktop App Launched");

let watching = true; //AnimationType

function findBoards() {
  return (
    document.getElementsByTagName("chess-board")[0] ||
    document.getElementById("game-board") ||
    document.getElementById("board-board")
  );
}

let firstTime = true

let coordinates = null;

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
  hideCoordinates();
  domtoimage
    .toPng(board, {
      style: { left: "0", top: "0", bottom: "0", right: "0" },
    })
    .then(function (dataUrl) {
      console.log("Updated board.");
      ipcRenderer.send("board-change", dataUrl);
      showCoordinates();
    });
  // kill any instance of this as it wont go away when window isnt in focus
  if ((modals = document.getElementsByClassName("board-dialog-component")))
    for (var i = 0; i < modals.length; i++) modals[i].remove();
}

function watchBoard() {
  console.log("Watching board");
  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.target.closest(".dragging")) return;
        if (
            mut.addedNodes[0] === coordinates ||
            mut.removedNodes[0] === coordinates
        ) {
            return;
        }
      }
      if (firstTime) {
          firstTime = !firstTime
          return
      }
    console.log("Piece changed.");
    updateBoard(findBoards());
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
