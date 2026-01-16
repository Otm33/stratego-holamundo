/**
 * controlador de la fase de Setup (Etapa II)
 * permite colocar las 10 piezas en el tablero antes de iniciar la partida
 */

import { Board } from './core/board.js';
import { BoardRenderer } from './ui/board-renderer.js';
import { Piece } from './core/piece.js';
import { PIECE_RANKS } from '../utils/constants.js';
import { WebSocketManager } from './network/websocket-manager.js';
import { API_CONFIG } from '../utils/constants.js';

// variables globales
let board = null;
let renderer = null;
let wsManager = null;

// datos de la partida desde localStorage
const matchId = localStorage.getItem('matchId');
const myTeam = localStorage.getItem('myTeam');
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');
const protocolMode = localStorage.getItem('protocolMode');

// inventario de 10 piezas (duelo rapido)
const QUICK_DUEL_INVENTORY = [
    { rank: PIECE_RANKS.MARSHAL, count: 1, label: '1' },
    { rank: PIECE_RANKS.GENERAL, count: 1, label: '2' },
    { rank: PIECE_RANKS.MINER, count: 2, label: '8' },
    { rank: PIECE_RANKS.SCOUT, count: 2, label: '9' },
    { rank: PIECE_RANKS.SPY, count: 1, label: 'S' },
    { rank: PIECE_RANKS.BOMB, count: 2, label: 'B' },
    { rank: PIECE_RANKS.FLAG, count: 1, label: 'F' }
];

let piecesPlaced = 0;
const TOTAL_PIECES = 10;

// ========================================
// INICIALIZACION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // validar que venimos del lobby con datos validos
    if (!matchId || !myTeam || !userId) {
        alert('Error: No hay datos de partida. Volviendo al lobby...');
        window.location.href = 'lobby.html';
        return;
    }

    // mostrar equipo asignado
    document.getElementById('team-display').innerHTML = `Equipo: <strong>${myTeam}</strong>`;

    // inicializar tablero
    board = new Board();
    renderer = new BoardRenderer('board');
    renderer.render(board.matrix);

    // resaltar filas validas según el equipo
    highlightValidRows();

    // inicializar inventario
    initializeInventory();

    // conectar WebSocket
    connectWebSocket();

    // event listeners
    setupDragAndDrop();
    setupButtons();
});


// ========================================
// WEBSOCKET Y SSE
// ========================================

function connectWebSocket() {
    wsManager = new WebSocketManager();
    wsManager.connect(userId, username);
    wsManager.on('match_started', handleMatchStarted);
    
    // conexion a SSE
    connectSSE();
}

function connectSSE() {
    const eventSource = new EventSource(`${API_CONFIG.API_URL}/api/events/stream?userId=${userId}`);
    
    eventSource.addEventListener('match_started', (e) => {
        const data = JSON.parse(e.data);
        handleMatchStarted(data);
    });

    eventSource.onerror = (error) => {
        console.error('error en SSE:', error);
    };
}

function handleMatchStarted(payload) {
    console.log(' partida iniciada:', payload);
    alert('¡mmbos listos! Iniciando batalla...');
    
    // guardar datos adicionales
    localStorage.setItem('yourTurn', payload.yourTurn);
    
    // redirigir al juego
    window.location.href = 'game.html';
}



// ========================================
// RESALTAR FILAS VALIDAS
// ========================================

function highlightValidRows() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        
        // RED: filas 6-9 (inferiores)
        // BLUE: filas 0-3 (superiores)
        const isValid = (myTeam === 'RED' && row >= 6) || (myTeam === 'BLUE' && row <= 3);
        
        if (isValid && board.matrix[row][parseInt(cell.dataset.col)] === null) {
            cell.classList.add('valid-deployment');
        }
    });
}

// ========================================
// INVENTARIO
// ========================================

function initializeInventory() {
    const inventoryElement = document.getElementById('inventory');
    inventoryElement.innerHTML = '';

    QUICK_DUEL_INVENTORY.forEach(pieceData => {
        for (let i = 0; i < pieceData.count; i++) {
            const pieceDiv = document.createElement('div');
            pieceDiv.classList.add('piece');
            if (myTeam === 'BLUE') pieceDiv.classList.add('blue');
            pieceDiv.innerText = pieceData.label;
            pieceDiv.draggable = true;

            pieceDiv.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    source: 'inventory',
                    rank: pieceData.rank,
                    team: myTeam
                }));
            });

            inventoryElement.appendChild(pieceDiv);
        }
    });
}

// ========================================
// DRAG & DROP
// ========================================

function setupDragAndDrop() {
    const boardElement = document.getElementById('board');

    boardElement.addEventListener('dragover', (e) => e.preventDefault());

    boardElement.addEventListener('drop', (e) => {
        e.preventDefault();

        const dataRaw = e.dataTransfer.getData('text/plain');
        if (!dataRaw) return;
        const data = JSON.parse(dataRaw);

        const targetCell = e.target.closest('.cell');
        if (!targetCell) return;

        const row = parseInt(targetCell.dataset.row);
        const col = parseInt(targetCell.dataset.col);

        // validar fila segun equipo
        const isValidRow = (myTeam === 'RED' && row >= 6) || (myTeam === 'BLUE' && row <= 3);
        
        if (!isValidRow) {
            alert(`Solo puedes colocar piezas en tus 4 filas ${myTeam === 'RED' ? 'inferiores' : 'superiores'}`);
            return;
        }

        // si viene del inventario, colocar pieza
        if (data.source === 'inventory') {
            if (board.matrix[row][col] === null) {
                board.matrix[row][col] = new Piece(data.rank, data.team);
                piecesPlaced++;
                e.target.closest('.inventory-grid').querySelector('.piece').remove();
                checkIfReady();
            }
        } 
        // si viene del tablero, mover pieza
        else if (data.source === 'board') {
            const fromRow = data.fromRow;
            const fromCol = data.fromCol;
            const piece = board.matrix[fromRow][fromCol];

            if (board.matrix[row][col] === null) {
                board.matrix[row][col] = piece;
                board.matrix[fromRow][fromCol] = null;
            } else {
                // intercambiar
                const temp = board.matrix[row][col];
                board.matrix[row][col] = piece;
                board.matrix[fromRow][fromCol] = temp;
            }
        }

        renderer.render(board.matrix);
        highlightValidRows();
    });
}

// ========================================
// BOTONES
// ========================================

function setupButtons() {
    document.getElementById('randomize-btn').addEventListener('click', randomizePieces);
    document.getElementById('ready-btn').addEventListener('click', sendSetup);
    document.getElementById('save-strategy-btn').addEventListener('click', saveStrategy);
    document.getElementById('load-strategy-btn').addEventListener('click', loadStrategy);
}

function randomizePieces() {
    // limpiar tablero
    clearBoard();
    
    const validCells = [];
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const isValid = (myTeam === 'RED' && row >= 6) || (myTeam === 'BLUE' && row <= 3);
            if (isValid && board.matrix[row][col] !== 'LAKES') {
                validCells.push({ row, col });
            }
        }
    }

    // mezclar casillas
    validCells.sort(() => Math.random() - 0.5);

    // colocar piezas
    let index = 0;
    QUICK_DUEL_INVENTORY.forEach(pieceData => {
        for (let i = 0; i < pieceData.count; i++) {
            const pos = validCells[index++];
            board.matrix[pos.row][pos.col] = new Piece(pieceData.rank, myTeam);
        }
    });

    piecesPlaced = TOTAL_PIECES;
    document.getElementById('inventory').innerHTML = '<p style="color: #2ecc71;"> todas las piezas colocadas</p>';
    
    renderer.render(board.matrix);
    checkIfReady();
}

function clearBoard() {
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            if (board.matrix[row][col] && typeof board.matrix[row][col] === 'object') {
                board.matrix[row][col] = null;
            }
        }
    }
    piecesPlaced = 0;
    initializeInventory();
}

function checkIfReady() {
    document.getElementById('ready-btn').disabled = (piecesPlaced < TOTAL_PIECES);
}

function saveStrategy() {
    const strategy = [];
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const piece = board.matrix[row][col];
            if (piece && typeof piece === 'object') {
                strategy.push({ rank: piece.rank, row, col });
            }
        }
    }
    localStorage.setItem('saved_strategy', JSON.stringify(strategy));
    alert(' estrategia guardada');
}

function loadStrategy() {
    const saved = localStorage.getItem('saved_strategy');
    if (!saved) {
        alert('no hay estrategia guardada');
        return;
    }

    clearBoard();
    const strategy = JSON.parse(saved);
    
    strategy.forEach(item => {
        board.matrix[item.row][item.col] = new Piece(item.rank, myTeam);
        piecesPlaced++;
    });

    document.getElementById('inventory').innerHTML = '<p style="color: #2ecc71;"> estrategia cargada</p>';
    renderer.render(board.matrix);
    checkIfReady();
}

// ========================================
// ENVIAR SETUP AL SERVIDOR
// ========================================

function sendSetup() {
    const pieces = [];
    
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 10; col++) {
            const piece = board.matrix[row][col];
            if (piece && typeof piece === 'object') {
                pieces.push({
                    type: getPieceType(piece.rank),
                    rank: piece.rank,
                    team: myTeam,
                    position: { x: col, y: row },
                    isRevealed: false
                });
            }
        }
    }

    if (protocolMode === 'SOCKET_FIRST') {
        sendSetupViaWebSocket(pieces);
    } else {
        sendSetupViaREST(pieces);
    }

    document.getElementById('ready-btn').disabled = true;
    document.getElementById('ready-btn').textContent = ' esperando oponente...';
    document.getElementById('opponent-status').textContent = 'esperando al oponente...';
}

async function sendSetupViaREST(pieces) {
    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/matches/${matchId}/setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userId}`
            },
            body: JSON.stringify({ pieces })
        });

        if (!response.ok) throw new Error('Error al enviar setup');
        console.log('setup enviado por REST');
    } catch (error) {
        console.error('error enviando setup:', error);
        alert('error al enviar la configuración');
    }
} 

function sendSetupViaWebSocket(pieces) {
    wsManager.socket.send(JSON.stringify({
        event: 'set_setup',
        data: {
            matchId: matchId,
            pieces: pieces
        }
    }));
    console.log(' setup enviado por WebSocket');
}

function getPieceType(rank) {
    const types = {
        1: 'MARSHAL', 2: 'GENERAL', 8: 'MINER', 9: 'SCOUT',
        10: 'SPY', 11: 'BOMB', 0: 'FLAG'
    };
    return types[rank] || 'UNKNOWN';
}
