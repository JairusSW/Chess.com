// preload for chess.com

const { ipcRenderer } = require('electron');
const domtoimage = require('dom-to-image');

document.__defineGetter__("visibilityState", () => "visible")
document.__defineGetter__("hidden", () => false)

console.log('Chess.com desktop script injected successfuly')

// Gather all chess boards in current view so we can determine someone has made a move
var mutationObservers = [];
var watching = false; //AnimationType

function watchBoard(toWatch) {

    var mutationObserver = new MutationObserver((mutation) => {

        if (mutation[0].target.closest('.dragging')) return; // moving

        var board = mutation[0].target.closest('.layout-board-section') || 
                    mutation[0].target.closest('#board-layout-main') || 
                    mutation[0].target.closest('.game-board-component') || 
                    mutation[0].target.closest('.main-tab-game-board-container');
        if (!board) return;
        
        domtoimage.toPng(board, { style: {left: '0', top: '0'}}).then(function (dataUrl) {
            ipcRenderer.send('board-change', dataUrl);
        });

        // kill any instance of this as it wont go away when window isnt in focus
        if (modals = document.getElementsByClassName('board-dialog-component')) for (var i = 0; i < modals.length; i++) modals[i].remove();

    });
    mutationObserver.observe(toWatch, {
        /*attributes: true,
        characterData: true,*/
        childList: true,
        subtree: true,
        /*attributeOldValue: true,
        characterDataOldValue: true*/
    });
    mutationObservers.push(mutationObserver);
}


function enableBoardObservers() {
    watching = true;
    console.log('observing board changes');

    var boards = document.getElementsByTagName("chess-board");
    for (var i = 0; i < boards.length; i++) watchBoard(boards[i])

    if (document.getElementById('game-board')) watchBoard(document.getElementById('game-board'))

    var eventBoards = document.getElementsByClassName('game-board-component');
    for (var i = 0; i < eventBoards.length; i++) watchBoard(eventBoards[i]);
    
    console.log("board observers", mutationObservers);
}

function disableBoardObservers() {
    watching = false;
    console.log('disabling observers');

    for (var i = 0; i < mutationObservers.length; i++) {
        mutationObservers[i].disconnect();
        delete mutationObservers[i];
    }
    mutationObservers = [];
}

ipcRenderer.on('minimized', () => {
    enableBoardObservers();
});

ipcRenderer.on('visible', () => {
    disableBoardObservers();
});

// regrab observers when in page url changes
ipcRenderer.on('refresh-watchers', () => {
    if (watching) {
        disableBoardObservers();
        enableBoardObservers();
    }
});