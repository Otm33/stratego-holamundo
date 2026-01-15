import { Board } from './core/board.js';
import { BoardRenderer } from './ui/board-renderer.js';
import { Piece } from './core/piece.js';
import { PIECE_RANKS, BOARD_CONFIG } from '../utils/constants.js';
import { validateMove, resolveCombat } from './core/rules.js';

//constante que contiene los valores del estado del juego
const GAME_STATE = {
  phase: 'SETUP', // prepparacion (SETUP) o juego (PLAY)
  turn: 'RED',    // turno de jugador rojo (RED) o azul (BLUE)
  winner: null
};

document.addEventListener('DOMContentLoaded', () => {
  const board = new Board();
  const renderer = new BoardRenderer('board');
  renderer.render(board.matrix);

  //inicializa el inventario en equipo rojo que es el predetermindado
  initializeFullInventory('RED');

  // Añadir un indicador de turno en el HTML (si no existe, lo creamos al vuelo)
  let statusDisplay = document.getElementById('game-status');
  if (!statusDisplay) {
    statusDisplay = document.createElement('div');
    statusDisplay.id = 'game-status';
    //css y texto añadidos para el estado de juego 
    statusDisplay.style.cssText = 'text-align: center; border-radius: 30px; color: white; font-size: 1.5rem; margin-bottom: 10px;';
    statusDisplay.innerText = 'FASE DE PREPARACION: Coloca tus tropas/piezas';
    document.body.insertBefore(statusDisplay, document.querySelector('.game-layout'));
  }

  // --- BOTÓN PARA INICIAR PARTIDA ---
  //funcionalidad para el boton de comenzar a jugar para que cambie el estado de la partida de setup a play
  const startBtn = document.createElement('button');
  //css y texto para el boton de comenzar la partida
  startBtn.innerText = 'Comenzar el juego';
  startBtn.style.cssText = 'display: block; margin: 10px auto; padding: 10px 20px; font-size: 1rem; cursor: pointer; border-radius: 30px; background-color: #D1BD43';

  startBtn.onclick = () => {
    if (GAME_STATE.phase === 'SETUP') {
      GAME_STATE.phase = 'PLAY';
      statusDisplay.innerText = `TURNO: ${GAME_STATE.turn}`;
      startBtn.style.display = 'none'; // Ocultar botón
      document.getElementById('inventory').style.opacity = '0.5'; //desactiva visualmente el inventario
      alert('¡La batalla ha comenzado!');
    }
  };
  document.body.insertBefore(startBtn, document.querySelector('.game-layout'));


  // eventos para el manejo del tablero
  const boardElement = document.getElementById('board');

  boardElement.addEventListener('dragover', (e) => e.preventDefault());

  boardElement.addEventListener('drop', (e) => {
    e.preventDefault();

    //si hay un ganador, congelar el juego
    if (GAME_STATE.winner) return;

    const dataRaw = e.dataTransfer.getData('text/plain');
    if (!dataRaw) return;
    const data = JSON.parse(dataRaw);

    const targetCell = e.target.closest('.cell');
    if (!targetCell) return;

    const row = parseInt(targetCell.dataset.row);
    const col = parseInt(targetCell.dataset.col);

    if (GAME_STATE.phase === 'SETUP') {
      //condicion para permitir mover desde el inventario
      if (data.source !== 'inventory') return;

      //solo se pueden colocar piezas en las 4 filas correspondientes al jugador, no a las del rival
      if (row < 6) {
        alert('En la fase de preparacion, solo puedes colocar piezas en tus 4 primeras filas (4 filas inferiores)');
        return;
      }

      // condicion para colocar pieza si esta vacia
      if (board.matrix[row][col] === null) {
        board.matrix[row][col] = new Piece(data.rank, data.team);
        renderer.render(board.matrix);
      }
    }

    //Logioca del juego
    else if (GAME_STATE.phase === 'PLAY') {

      //condicion que bloquea el inventario en fase de juego
      if (data.source === 'inventory') {
        alert('La batalla ya empezo. No puedes colocar mas tropas/piezas');
        return;
      }
      const piece = board.matrix[data.fromRow][data.fromCol];

      //condicional que valida el turno del jugador
      if (piece.team !== GAME_STATE.turn) {
        alert(`Es el turno del jugador ${GAME_STATE.turn}`);
        return;
      }

      //validacion del movimiento
      const moveCheck = validateMove(board, { row: data.fromRow, col: data.fromCol }, { row, col }, piece);
      if (!moveCheck.valid) {
        console.log(moveCheck.message);
        return;
      }

      //ejecuta el movimiento
      const destinationContent = board.matrix[row][col];
      let moveSuccessful = false;

      if (destinationContent === null) {
        //mover a vacio
        board.matrix[row][col] = piece;
        board.matrix[data.fromRow][data.fromCol] = null;
        moveSuccessful = true;
      } else if (typeof destinationContent === 'object') {
        //combate
        const winner = resolveCombat(piece, destinationContent);

        //condicional para definir que pasa si el ganador es el atacante o el defensor
        if (winner === 'ATTACKER') {
          board.matrix[row][col] = piece;
          board.matrix[data.fromRow][data.fromCol] = null;

          //condicion para si un jugador captura la bandera, gana el juego automaticamente
          if (destinationContent.rank === PIECE_RANKS.FLAG) {
            GAME_STATE.winner = piece.team;
            alert(`¡VICTORIA! El equipo ${piece.team} ha capturado la bandera.`);
            statusDisplay.innerText = `GANADOR: ${piece.team}`;
          }
        } else if (winner === 'DEFENDER') {
          board.matrix[data.fromRow][data.fromCol] = null;
        } else if (winner === 'DRAW') {
          board.matrix[row][col] = null;
          board.matrix[data.fromRow][data.fromCol] = null;
        }
        moveSuccessful = true;
      }

      //condicional para cambiar de turno entre jugador y jugador
      if (moveSuccessful && !GAME_STATE.winner) {
        GAME_STATE.turn = GAME_STATE.turn === 'RED' ? 'BLUE' : 'RED';
        statusDisplay.innerText = `TURNO: ${GAME_STATE.turn}`;
        renderer.render(board.matrix);
      } else {
        renderer.render(board.matrix);
      }
    }
  });
});


//inicializa el inventario con 40 piezas
function initializeFullInventory(team) {
  const inventoryElement = document.getElementById('inventory');
  inventoryElement.innerHTML = '';

  //todas las piezas con sus datos correspondientes
  const armyConfig = [
    { rank: PIECE_RANKS.MARSHAL, count: 1, label: '1' },
    { rank: PIECE_RANKS.GENERAL, count: 1, label: '2' },
    { rank: PIECE_RANKS.COLONEL, count: 2, label: '3' },
    { rank: PIECE_RANKS.MAJOR, count: 3, label: '4' },
    { rank: PIECE_RANKS.CAPTAIN, count: 4, label: '5' },
    { rank: PIECE_RANKS.LIEUTENANT, count: 4, label: '6' },
    { rank: PIECE_RANKS.SERGEANT, count: 4, label: '7' },
    { rank: PIECE_RANKS.MINER, count: 5, label: '8' },
    { rank: PIECE_RANKS.SCOUT, count: 8, label: '9' },
    { rank: PIECE_RANKS.SPY, count: 1, label: 'S' },
    { rank: PIECE_RANKS.BOMB, count: 6, label: 'Bomb' },
    { rank: PIECE_RANKS.FLAG, count: 1, label: 'Flag' }
  ];

  armyConfig.forEach(pData => {
    for (let i = 0; i < pData.count; i++) {
      const pieceDiv = document.createElement('div');
      pieceDiv.classList.add('piece');
      if (team === 'BLUE') pieceDiv.classList.add('blue');
      pieceDiv.innerText = pData.label;
      pieceDiv.draggable = true;
      pieceDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          source: 'inventory',
          rank: pData.rank,
          team: team
        }));
      });
      inventoryElement.appendChild(pieceDiv);
    }
  });
}