
//  ESTADO GLOBAL
const matchId = localStorage.getItem('matchId') || crypto.randomUUID();
localStorage.setItem('matchId', matchId);

const myTeam = localStorage.getItem('myTeam') || 'RED';
const userId = localStorage.getItem('userId') || 'user123';
const username = localStorage.getItem('username') || 'Jugador';
const protocolMode = localStorage.getItem('protocolMode') || 'WS_ONLY';

let yourTurn = (myTeam === 'RED');
let opponentReady = false;
let gamePhase = 'SETUP'; // SETUP, PLAY, GAME_OVER
let boardState = {};
let socket = null;

//CONFIGURACION DEL JUEGO
const BOARD_SIZE = 10;
const LAKES = [
    {x:4,y:2},{x:4,y:3},{x:5,y:2},{x:5,y:3},
    {x:4,y:6},{x:4,y:7},{x:5,y:6},{x:5,y:7}
];

const QUICK_DUEL_PIECES = [
    { type: 'MARSHAL', rank: 10, count: 1 },
    { type: 'GENERAL', rank: 9, count: 1 },
    { type: 'CAPTAIN', rank: 6, count: 2 },
    { type: 'SERGEANT', rank: 4, count: 2 },
    { type: 'MINER', rank: 3, count: 2 },
    { type: 'SCOUT', rank: 2, count: 4 },
    { type: 'BOMB', rank: 0, count: 2 },
    { type: 'FLAG', rank: 0, count: 1 }
];

// Helpers
function isLake(x, y) { return LAKES.some(l => l.x === x && l.y === y); }
function getPieceAt(x, y) { return boardState[`${x},${y}`]; }
function shuffleArray(arr) { 
    for(let i=arr.length-1;i>0;i--){ 
        const j=Math.floor(Math.random()*(i+1)); 
        [arr[i],arr[j]]=[arr[j],arr[i]]; 
    } 
}

//CREACION DEL TABLERO (DOM)
const boardEl = document.getElementById('board');
boardEl.innerHTML = '';
for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if (isLake(x, y)) cell.classList.add('lake');
        cell.dataset.x = x;
        cell.dataset.y = y;

        // eventos de Drop
        cell.addEventListener('dragover', e => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = 'move';
        });

        cell.addEventListener('drop', e => {
            e.preventDefault();
            e.stopPropagation(); // Evitar burbujeo
            const rawData = e.dataTransfer.getData('text/plain');
            if (!rawData) return;
            const from = JSON.parse(rawData);
            attemptMove(from, { x, y });
        });

        boardEl.appendChild(cell);
    }
}

//RENDERIZADO DE PIEZAS
function renderPieces() {
    document.querySelectorAll('.piece').forEach(p => p.remove());

    Object.entries(boardState).forEach(([key, piece]) => {
        if (!piece || !piece.team) return;

        const [x, y] = key.split(',').map(Number);
        const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
        if (!cell) return;

        const div = document.createElement('div');
        div.classList.add('piece', piece.team.toLowerCase());
        
        if (piece.team === myTeam) {
            div.textContent = `${piece.type.substring(0, 2)} (${piece.rank})`;
            div.classList.add('my-piece');
        } else {
            div.textContent = '?';
        }

        const isSetup = gamePhase === 'SETUP';
        const isMyTurn = gamePhase === 'PLAY' && yourTurn;
        const isMyPiece = piece.team === myTeam;
        const isMovable = piece.type !== 'BOMB' && piece.type !== 'FLAG';

        if (isMyPiece && (isSetup || (isMyTurn && isMovable))) {
            div.draggable = true;
            div.style.cursor = 'grab';
            div.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ x, y }));
                e.dataTransfer.effectAllowed = 'move';
                div.style.opacity = '0.5';
            });
            div.addEventListener('dragend', () => {
                div.style.opacity = '1';
            });
        }

        cell.appendChild(div);
    });
}

//VALIDACION DE REGLAS STRATEGO
function validateStrategoRules(from, to, piece) {
    if (!piece) return false; 

    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);

    // 1. reglas basicas
    if (from.x === to.x && from.y === to.y) return false; // mismo sitio
    if (from.x !== to.x && from.y !== to.y) return false; // diagonal prohibida
    if (isLake(to.x, to.y)) return false;
    if (piece.type === 'BOMB' || piece.type === 'FLAG') return false; // inmoviles

    // 2. fuego amigo
    const targetPiece = getPieceAt(to.x, to.y);
    if (targetPiece && targetPiece.team === myTeam) return false;

    // 3. reglas de distancia
    if (piece.type === 'SCOUT' || piece.rank === 2) {
        // explorador: verifica camino despejado
        const dist = Math.max(dx, dy);
        const stepX = (to.x - from.x) / dist || 0;
        const stepY = (to.y - from.y) / dist || 0;

        for (let i = 1; i < dist; i++) {
            const checkX = from.x + (stepX * i);
            const checkY = from.y + (stepY * i);
            if (isLake(checkX, checkY) || getPieceAt(checkX, checkY)) return false;
        }
    } else {
        // unidades normales: 1 paso
        if (dx > 1 || dy > 1) return false;
    }

    return true;
}

//INTELIGENCIA DE COMBATE
function resolveCombat(attacker, defender) {
    if (defender.type === 'BOMB') return (attacker.type === 'MINER') ? 'ATTACKER_WINS' : 'DEFENDER_WINS';
    if (defender.type === 'FLAG') return 'ATTACKER_WINS';
    if (attacker.type === 'SPY' && defender.type === 'MARSHAL') return 'ATTACKER_WINS';
    if (attacker.rank > defender.rank) return 'ATTACKER_WINS';
    if (attacker.rank < defender.rank) return 'DEFENDER_WINS';
    return 'BOTH_ELIMINATED';
}

//MOTOR DE MOVIMIENTO PRINCIPAL
function attemptMove(from, to) {
    const fromKey = `${from.x},${from.y}`;
    const toKey = `${to.x},${to.y}`;
    
    // si soltamos en el mismo lugar, cancelamos TODO para evitar borrado accidental
    if (fromKey === toKey) return; 

    const piece = boardState[fromKey];
    if (!piece) return; // si no hay pieza origen, salir

    const target = boardState[toKey];

    // -- FASE DE SETUP --
    if (gamePhase === 'SETUP') {
        const myMinY = myTeam === 'RED' ? 0 : 6;
        const myMaxY = myTeam === 'RED' ? 3 : 9;

        // Validar zona permitida
        if (to.y < myMinY || to.y > myMaxY) return; 
        if (isLake(to.x, to.y)) return;

        // Intercambio seguro (Swap)
        boardState[toKey] = piece;
        if (target) {
            boardState[fromKey] = target;
        } else {
            delete boardState[fromKey];
        }
        
        renderPieces();
        return;
    }

    // -- FASE DE JUEGO --
    if (gamePhase !== 'PLAY' || !yourTurn) return;

    // validacion estricta
    if (!validateStrategoRules(from, to, piece)) {
        console.warn("Movimiento inválido");
        return;
    }

    let combatResult = 'MOVE';

    if (target) {
        combatResult = resolveCombat(piece, target);
        
        if (combatResult === 'ATTACKER_WINS') {
            boardState[toKey] = piece;
            delete boardState[fromKey];
            if (target.type === 'FLAG') showGameOver(true);
        } else if (combatResult === 'DEFENDER_WINS') {
            delete boardState[fromKey];
        } else if (combatResult === 'BOTH_ELIMINATED') {
            delete boardState[fromKey];
            delete boardState[toKey];
        }
    } else {
        boardState[toKey] = piece;
        delete boardState[fromKey];
    }

    renderPieces();
    yourTurn = false;
    updateTurnIndicator();

    // enviar al servidor
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            action: 'MOVE',
            matchId,
            userId,
            move: { from, to, result: combatResult }
        }));
    }
}

// 8. WEBSOCKET Y EVENTOS
function initWebSocket() {
    socket = new WebSocket('ws://localhost:8080');
    socket.onopen = () => console.log('✅ Conectado al servidor');
    socket.onmessage = (msg) => handleServerEvent(JSON.parse(msg.data));
    socket.onerror = (err) => console.error('Error WS:', err);
}

function handleServerEvent(event) {
    console.log('Evento:', event.action);
    switch (event.action) {
        case 'OPPONENT_SETUP_COMPLETE':
            opponentReady = true;
            if (event.pieces) {
                Object.entries(event.pieces).forEach(([k, p]) => {
                    if (p.team !== myTeam) boardState[k] = { ...p, team: p.team };
                });
                renderPieces();
            }
            alert("¡Oponente listo!");
            break;

        case 'OPPONENT_MOVED':
            const { from, to, result } = event.move;
            const fromKey = `${from.x},${from.y}`;
            const toKey = `${to.x},${to.y}`;
            const attacker = boardState[fromKey];

            if (result === 'ATTACKER_WINS') {
                boardState[toKey] = attacker;
                delete boardState[fromKey];
            } else if (result === 'DEFENDER_WINS') {
                delete boardState[fromKey];
            } else if (result === 'BOTH_ELIMINATED') {
                delete boardState[fromKey];
                delete boardState[toKey];
            } else {
                boardState[toKey] = attacker;
                delete boardState[fromKey];
            }
            yourTurn = true;
            updateTurnIndicator();
            renderPieces();
            break;

        case 'FLAG_CAPTURED':
            showGameOver(event.winnerTeam === myTeam);
            break;
            
        case 'OPPONENT_SURRENDERED':
            showGameOver(true);
            break;
    }
}

// 9. UI HELPERS
function randomizePieces() {
    if (gamePhase !== 'SETUP') return;
    boardState = {}; 
    const startRow = myTeam === 'RED' ? 0 : 6;
    const endRow = myTeam === 'RED' ? 3 : 9;
    let validCells = [];
    for(let y=startRow; y<=endRow; y++){
        for(let x=0; x<BOARD_SIZE; x++){
            if(!isLake(x,y)) validCells.push({x,y});
        }
    }
    shuffleArray(validCells);
    let piecePool = [];
    QUICK_DUEL_PIECES.forEach(p => {
        for(let i=0; i<p.count; i++) piecePool.push({...p});
    });
    piecePool.forEach((p, i) => {
        if(validCells[i]) {
            const pos = validCells[i];
            boardState[`${pos.x},${pos.y}`] = { ...p, team: myTeam };
        }
    });
    renderPieces();
}

document.getElementById('randomize-btn').addEventListener('click', randomizePieces);

document.getElementById('start-btn').addEventListener('click', () => {
    if (Object.keys(boardState).filter(k => boardState[k].team === myTeam).length === 0) {
        alert("Primero coloca tus fichas");
        return;
    }
    gamePhase = 'PLAY';
    updateTurnIndicator();
    renderPieces();
    if(socket) {
        socket.send(JSON.stringify({
            action: 'SETUP_COMPLETE',
            matchId,
            userId,
            team: myTeam,
            pieces: boardState
        }));
    }
});

function updateTurnIndicator() {
    const el = document.getElementById('turn-indicator');
    if (gamePhase === 'SETUP') el.textContent = "Preparación: Coloca tus fichas";
    else if (gamePhase === 'GAME_OVER') el.textContent = "Juego Terminado";
    else el.textContent = yourTurn ? "¡TU TURNO!" : "Esperando oponente...";
    el.style.color = yourTurn ? 'green' : 'red';
}

function showGameOver(won) {
    gamePhase = 'GAME_OVER';
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('overlay-text').textContent = won ? "VICTORIA" : "DERROTA";
}

initWebSocket();
updateTurnIndicator();