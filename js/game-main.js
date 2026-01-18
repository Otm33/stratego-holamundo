import { Board } from './core/board.js';
import { BoardRenderer } from './ui/board-renderer.js';
import { Piece } from './core/piece.js';
import { PIECE_RANKS, BOARD_CONFIG } from '../utils/constants.js';
import { validateMove, resolveCombat } from './core/rules.js';
import { API_CONFIG } from '../utils/constants.js';

const matchId = localStorage.getItem('matchId');
const myTeam = localStorage.getItem('myTeam') || 'RED';
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');

const GAME_STATE = {
  phase: 'SETUP',
  turn: 'RED',
  winner: null
};

let currentMode = 'STANDARD';
let board = null;
let renderer = null;
let eventSource = null;
let statusDisplay = null;

let socket = null;
const protocolMode = localStorage.getItem('protocolMode');


function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  console.log('🔌 Conectando SSE...');
  eventSource = new EventSource(`${API_CONFIG.API_URL}/api/events/stream?userId=${userId}`);

  eventSource.addEventListener('match_started', handleMatchStarted);
  eventSource.addEventListener('opponent_moved', handleOpponentMoved);
  eventSource.addEventListener('combat_result', handleCombatResult);
  eventSource.addEventListener('match_cancelled', handleMatchCancelled);

  eventSource.onopen = () => {
    console.log('✅ SSE conectado correctamente');
  };

  eventSource.onerror = (error) => {
    console.error('❌ SSE error:', error);
    eventSource.close();
    console.log('🔄 Reintentando conexión SSE en 5 segundos...');
    setTimeout(connectSSE, 5000);
  };
}


function showTurnBlockModal() {
  const modal = document.createElement('div');
  modal.id = 'turn-block-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';

  modal.innerHTML = `
    <div style="background: #e74c3c; padding: 30px; border-radius: 10px; text-align: center;">
      <h2 style="color: white; margin: 0;">⏸️ ESPERA TU TURNO</h2>
      <p style="color: white; margin-top: 10px;">El oponente está moviendo...</p>
    </div>
  `;

  document.body.appendChild(modal);
}

function hideTurnBlockModal() {
  const modal = document.getElementById('turn-block-modal');
  if (modal) modal.remove();
}



function handleMatchStarted(event) {
  console.log('🎮 EVENTO MATCH_STARTED RECIBIDO:', event.data);

  try {
    const data = JSON.parse(event.data);
    const myTeam = localStorage.getItem('myTeam') || 'RED'; // <--- DEFINIMOS ESTO AQUÍ PARA EVITAR ERRORES

    // 1. Cambiar estado del juego
    GAME_STATE.phase = 'PLAYING';
    GAME_STATE.turn = data.turn; // Sincronizamos turno

    // 2. Actualizar texto de la UI
    const statusElement = document.getElementById('game-status');
    if (statusElement) {
      statusElement.innerText = data.turn === myTeam ? 'TU TURNO' : 'TURNO RIVAL';
    }

    // 3. Ocultar interfaz de configuración
    const toolbar = document.querySelector('.toolbar');
    const sidebar = document.querySelector('.sidebar');
    if (toolbar) toolbar.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';

    // 4. Inicializar tablero si no existe (Seguridad)
    if (!board) {
      console.warn('⚠️ Board no existía, creando uno nuevo...');
      board = new Board();
    }

    // 5. --- LOGICA DE NIEBLA DE GUERRA ---
    // Colocamos las piezas enemigas ocultas
    const opponentTeam = myTeam === 'RED' ? 'BLUE' : 'RED';
    const startRow = myTeam === 'RED' ? 0 : 6;
    const endRow = myTeam === 'RED' ? 3 : 9;

    console.log(`🤖 Creando enemigos (${opponentTeam}) en filas ${startRow}-${endRow}`);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c < 10; c++) {
        // Verificamos que board.matrix[r] exista antes de acceder
        if (board.matrix[r] && board.matrix[r][c] === null) {
          // Asegúrate de que la clase Piece esté importada al inicio del archivo
          const enemyPiece = new Piece('unknown', opponentTeam);
          enemyPiece.isRevealed = false;
          board.matrix[r][c] = enemyPiece;
        }
      }
    }
    // -------------------------------------

    // 6. Inicializar y Renderizar (Seguridad contra renderer nulo)
    if (!renderer) {
      console.warn('⚠️ Renderer no existía, inicializando...');
      renderer = new BoardRenderer('board');
    }

    // Renderizamos el tablero final
    renderer.render(board.matrix);

    console.log('✅ Partida iniciada correctamente.');
    alert('¡La batalla ha comenzado!');

  } catch (error) {
    console.error("❌ ERROR CRÍTICO AL INICIAR PARTIDA:", error);
    alert("Hubo un error al iniciar la batalla. Revisa la consola (F12).");
  }
}

function handleOpponentMoved(event) {
  console.log('👁️👁️👁️ opponent_moved RECIBIDO:', event.data);
  const data = JSON.parse(event.data);
  const { from, to } = data.move;

  console.log(`🚶 Moviendo pieza enemiga de (${from.y},${from.x}) a (${to.y},${to.x})`);

  const piece = board.matrix[from.y][from.x];
  board.matrix[to.y][to.x] = piece;
  board.matrix[from.y][from.x] = null;

  renderer.render(board.matrix);

  GAME_STATE.turn = myTeam;
  hideTurnBlockModal();
  showYourTurnNotification();
  document.getElementById('game-status').innerText = 'TU TURNO';
}




function handleCombatResult(event) {
  console.log('⚔️ combat_result recibido:', event.data);
  const data = JSON.parse(event.data);
  const { attacker, defender, winner } = data;

  // Determinar si yo ataqué para gestionar el turno después
  const wasMyAttack = attacker.team === myTeam;

  if (winner === 'ATTACKER') {
    // El atacante gana y se mueve a la posición del defensor
    // CREAMOS la pieza nueva en la posición destino
    const survivingPiece = new Piece(attacker.rank, attacker.team);

    // IMPORTANTE: Como acaba de combatir, ahora es visible para todos
    survivingPiece.isRevealed = true;

    board.matrix[defender.position.y][defender.position.x] = survivingPiece;
    board.matrix[attacker.position.y][attacker.position.x] = null;

  } else if (winner === 'DEFENDER') {
    // El defensor gana, el atacante muere.
    board.matrix[attacker.position.y][attacker.position.x] = null;

    // IMPORTANTE: Buscamos la pieza defensora que sobrevivió y la revelamos
    const survivingPiece = board.matrix[defender.position.y][defender.position.x];
    if (survivingPiece) {
      survivingPiece.isRevealed = true;
    }

  } else if (winner === 'DRAW') {
    // Ambos mueren
    board.matrix[attacker.position.y][attacker.position.x] = null;
    board.matrix[defender.position.y][defender.position.x] = null;
  }

  renderer.render(board.matrix);

  // (El resto de tu lógica de turnos se mantiene igual)
  if (wasMyAttack) {
    GAME_STATE.turn = myTeam === 'RED' ? 'BLUE' : 'RED';
    document.getElementById('game-status').innerText = 'turno del oponente';
  } else {
    GAME_STATE.turn = myTeam;
    hideTurnBlockModal();
    showYourTurnNotification();
    document.getElementById('game-status').innerText = 'TU TURNO';
  }
}





function handleMatchCancelled(event) {
  const data = JSON.parse(event.data);
  alert(`partida cancelada: ${data.reason}`);
  showVictoryModal(data.retiredPlayer.team === myTeam ?
    (myTeam === 'RED' ? 'BLUE' : 'RED') : myTeam);
}





document.addEventListener('DOMContentLoaded', () => {
  board = new Board();
  renderer = new BoardRenderer('board');
  connectSSE();

  if (protocolMode === 'SOCKET_FIRST') {
    socket = new WebSocket(`wss://stratego-api.koyeb.app/gateway?userId=${userId}`);

    socket.addEventListener('open', () => console.log('WebSocket conectado'));
    socket.addEventListener('message', handleWebSocketMessage);
  }

  function handleWebSocketMessage(event) {
    const { type, payload } = JSON.parse(event.data);

    if (type === 'opponent_moved') handleOpponentMoved({ data: JSON.stringify(payload) });
    if (type === 'combat_result') handleCombatResult({ data: JSON.stringify(payload) });
    if (type === 'match_started') handleMatchStarted({ data: JSON.stringify(payload) });
  }


  // Randomizar automáticamente al inicio
  const mode = localStorage.getItem('mode') === 'QUICK_DUEL' ? 'DUEL' : 'STANDARD';
  currentMode = mode;
  randomizePieces(board, myTeam, mode);
  renderer.render(board.matrix);

  // Ocultar inventario
  document.getElementById('inventory').innerHTML = '<p style="color: #2ecc71;">✅ Piezas colocadas aleatoriamente</p>';

  statusDisplay = document.getElementById('game-status');
  if (!statusDisplay) {
    statusDisplay = document.createElement('div');
    statusDisplay.id = 'game-status';
    statusDisplay.style.cssText = 'text-align: center; border-radius: 30px; color: white; font-size: 1.5rem; margin-bottom: 10px;';
    statusDisplay.innerText = 'FASE DE PREPARACION - Presiona "Comenzar el juego"';
    document.body.insertBefore(statusDisplay, document.querySelector('.game-layout'));
  }

  const startBtn = document.createElement('button');
  startBtn.innerText = 'Comenzar el juego';
  startBtn.style.cssText = 'display: block; margin: 10px auto; padding: 10px 20px; font-size: 1rem; cursor: pointer; border-radius: 30px; background-color: #D1BD43';

  const isChallenger = localStorage.getItem('isChallenger');

  if (isChallenger === 'false') {

    sendSetup().then(() => {
      console.log('✅ Setup del retado enviado');
    }).catch(error => {
      console.error('❌ Error al enviar setup:', error);
    });

    startBtn.style.display = 'none';
    statusDisplay.innerText = '⏳ Esperando que el creador inicie la partida...';
  }

  startBtn.onclick = async () => {
    if (GAME_STATE.phase === 'SETUP') {

      const piecesPlaced = board.matrix.flat().filter(cell =>
        cell instanceof Piece && cell.team === myTeam
      ).length;

      const requiredPieces = currentMode === 'DUEL' ? 10 : 40;

      if (piecesPlaced < requiredPieces) {
        alert(`Faltan ${requiredPieces - piecesPlaced} piezas por colocar`);
        return;
      }

      // verificar que tiene la bandera
      const hasFlag = board.matrix.flat().some(cell =>
        cell instanceof Piece && cell.team === myTeam && cell.rank === PIECE_RANKS.FLAG
      );

      if (!hasFlag) {
        alert('Debes colocar tu bandera antes de comenzar');
        return;
      }

      await sendSetup();


      statusDisplay.innerText = 'Esperando al oponente...';
      startBtn.style.display = 'none';

    }
  };
  document.body.insertBefore(startBtn, document.querySelector('.game-layout'));


  async function sendSetup() {
    const pieces = [];

    board.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell instanceof Piece && cell.team === myTeam) {
          pieces.push({
            type: getPieceType(cell.rank),
            rank: cell.rank,
            team: cell.team,
            position: { x, y },
            isRevealed: false
          });
        }
      });
    });

    try {
      const response = await fetch(`${API_CONFIG.API_URL}/api/matches/${matchId}/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`
        },
        body: JSON.stringify({ pieces })
      });

      console.log('📡 Setup enviado. Status:', response.status);
    } catch (error) {
      console.error('❌ Error en sendSetup:', error);
    }
  }



  function getPieceType(rank) {
    const types = {
      0: 'FLAG', 1: 'MARSHAL', 2: 'GENERAL', 3: 'COLONEL',
      4: 'MAJOR', 5: 'CAPTAIN', 6: 'LIEUTENANT', 7: 'SERGEANT',
      8: 'MINER', 9: 'SCOUT', 10: 'SPY', 11: 'BOMB'
    };
    return types[rank];
  }



  const surrenderBtn = document.createElement('button');
  surrenderBtn.id = 'surrenderBtn';
  surrenderBtn.innerText = '🏳️ Rendirse';
  surrenderBtn.style.cssText = 'display: none; margin: 10px auto; padding: 10px 20px; font-size: 1rem; cursor: pointer; border-radius: 30px; background-color: #e74c3c; color: white;';
  surrenderBtn.onclick = async () => {
    if (!confirm('¿Estás seguro que deseas rendirte?')) return;

    try {
      const response = await fetch(`${API_CONFIG.API_URL}/api/matches/${matchId}/forfeit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userId}`
        },
        body: JSON.stringify({ reason: 'VOLUNTARY' })
      });

      if (response.ok) {
        const enemyTeam = myTeam === 'RED' ? 'BLUE' : 'RED';
        showVictoryModal(enemyTeam);
      }
    } catch (error) {
      console.error('Error al rendirse:', error);
    }
  };
  document.body.insertBefore(surrenderBtn, document.querySelector('.game-layout'));








  //controls.appendChild(btnClassic);
  //controls.appendChild(btnDuel);
  //document.querySelector('.game-layout').before(controls);

  // Eventos del tablero (SOLO PARA JUEGO, NO PARA SETUP)
  const boardElement = document.getElementById('board');
  boardElement.addEventListener('dragover', (e) => e.preventDefault());
  boardElement.addEventListener('drop', handleDrop);
});

async function sendMove(fromRow, fromCol, toRow, toCol) {
  const moveData = {
    from: { x: fromCol, y: fromRow },
    to: { x: toCol, y: toRow }
  };

  if (protocolMode === 'SOCKET_FIRST' && socket && socket.readyState === WebSocket.OPEN) {
    console.log('📤 Enviando movimiento por WebSocket');
    socket.send(JSON.stringify({
      type: 'move',
      payload: {
        matchId: matchId,
        ...moveData
      }
    }));
  } else {
    console.log('📤 Enviando movimiento por Fetch API');
    const response = await fetch(`${API_CONFIG.API_URL}/api/matches/${matchId}/moves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userId}`
      },
      body: JSON.stringify(moveData)
    });

    if (!response.ok) {
      console.error('❌ Error al enviar movimiento:', response.status);
      return;
    }
  }

  // ✅ ACTUALIZAR TU PROPIO TABLERO LOCALMENTE
  const piece = board.matrix[fromRow][fromCol];
  board.matrix[toRow][toCol] = piece;
  board.matrix[fromRow][fromCol] = null;
  renderer.render(board.matrix);

  GAME_STATE.turn = myTeam === 'RED' ? 'BLUE' : 'RED';
  document.getElementById('game-status').innerText = 'turno del oponente';
}



async function handleDrop(e) {
  e.preventDefault();

  alert('DROP DETECTADO - Fase: ' + GAME_STATE.phase);
  console.log('🎯 Fase:', GAME_STATE.phase);
  console.log('🎯 dataTransfer:', e.dataTransfer.getData('text/plain'));

  if (GAME_STATE.phase !== 'PLAY') {
    console.log('❌ Movimiento bloqueado - fase actual:', GAME_STATE.phase);
    alert('Esperando que comience la partida...');
    return;
  }

  if (GAME_STATE.winner) return;

  const dataRaw = e.dataTransfer.getData('text/plain');
  if (!dataRaw) {
    console.log('❌ No hay datos en el drop');
    return;
  }

  const data = JSON.parse(dataRaw);
  console.log('📦 Datos del drag:', data);

  // Buscar la celda (permite soltar sobre pieza o celda vacía)
  let targetCell = e.target.closest('.cell');
  if (!targetCell && e.target.classList.contains('piece')) {
    targetCell = e.target.parentElement;
  }

  if (!targetCell) {
    console.log('❌ No se encontró celda destino');
    return;
  }

  const row = parseInt(targetCell.dataset.row);
  const col = parseInt(targetCell.dataset.col);
  console.log('📍 Destino:', row, col);

  if (GAME_STATE.phase === 'PLAY') {
    if (data.source === 'inventory') {
      alert('la batalla ya empezo. no puedes colocar mas tropas/piezas');
      return;
    }

    const piece = board.matrix[data.fromRow][data.fromCol];

    if (piece.team !== myTeam) {
      alert('no puedes mover piezas del oponente');
      return;
    }

    if (GAME_STATE.turn !== myTeam) {
      console.log('❌ NO ES TU TURNO. GAME_STATE.turn:', GAME_STATE.turn, '| myTeam:', myTeam);
      showTurnBlockModal();
      setTimeout(hideTurnBlockModal, 2000);
      return;
    }

    const moveCheck = validateMove(board, { row: data.fromRow, col: data.fromCol }, { row, col }, piece);
    if (!moveCheck.valid) {
      alert(moveCheck.message);
      return;
    }

    console.log('✅ Enviando movimiento al servidor');
    await sendMove(data.fromRow, data.fromCol, row, col);

  }
}


function showYourTurnNotification() {
  const modal = document.createElement('div');
  modal.id = 'turn-notification';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 9999;';

  modal.innerHTML = `
    <div style="background: #27ae60; padding: 30px; border-radius: 10px; text-align: center;">
      <h2 style="color: white; margin: 0;">✅ ES TU TURNO</h2>
      <p style="color: white; margin-top: 10px;">¡Puedes mover!</p>
    </div>
  `;

  document.body.appendChild(modal);

  setTimeout(() => {
    modal.remove();
  }, 2000);
}




function limpiarTablero() {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      if (board.matrix[row][col] !== 'LAKES') {
        board.matrix[row][col] = null;
      }
    }
  }
}

function randomizePieces(board, team, mode) {
  const validRows = mode === 'DUEL'
    ? (team === 'RED' ? [9] : [0])
    : (team === 'RED' ? [6, 7, 8, 9] : [0, 1, 2, 3]);

  const validCells = [];
  validRows.forEach(row => {
    for (let col = 0; col < 10; col++) {
      if (board.matrix[row][col] !== 'LAKES') {
        validCells.push({ row, col });
      }
    }
  });

  // Mezclar CADA VEZ diferente
  validCells.sort(() => Math.random() - 0.5);

  const armyConfig = mode === 'DUEL'
    ? [
      { rank: PIECE_RANKS.FLAG, count: 1 },
      { rank: PIECE_RANKS.MARSHAL, count: 1 },
      { rank: PIECE_RANKS.GENERAL, count: 1 },
      { rank: PIECE_RANKS.MINER, count: 2 },
      { rank: PIECE_RANKS.SCOUT, count: 2 },
      { rank: PIECE_RANKS.SPY, count: 1 },
      { rank: PIECE_RANKS.BOMB, count: 2 }
    ]
    : [
      { rank: PIECE_RANKS.FLAG, count: 1 },
      { rank: PIECE_RANKS.MARSHAL, count: 1 },
      { rank: PIECE_RANKS.GENERAL, count: 1 },
      { rank: PIECE_RANKS.COLONEL, count: 2 },
      { rank: PIECE_RANKS.MAJOR, count: 3 },
      { rank: PIECE_RANKS.CAPTAIN, count: 4 },
      { rank: PIECE_RANKS.LIEUTENANT, count: 4 },
      { rank: PIECE_RANKS.SERGEANT, count: 4 },
      { rank: PIECE_RANKS.MINER, count: 5 },
      { rank: PIECE_RANKS.SCOUT, count: 8 },
      { rank: PIECE_RANKS.SPY, count: 1 },
      { rank: PIECE_RANKS.BOMB, count: 6 }
    ];

  let index = 0;
  armyConfig.forEach(pieceData => {
    for (let i = 0; i < pieceData.count; i++) {
      const pos = validCells[index++];
      board.matrix[pos.row][pos.col] = new Piece(pieceData.rank, team);
    }
  });
}

const backBtn = document.createElement('button');
backBtn.innerText = 'Volver al Lobby';
backBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; padding: 5px 10px; background: none; border: 1px solid gray; cursor: pointer;';
backBtn.onclick = () => {
  window.location.href = 'lobby.html';
};
document.body.appendChild(backBtn);


function showVictoryModal(winnerTeam) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; z-index: 9999;';

  modal.innerHTML = `
    <div style="background: white; padding: 40px; border-radius: 15px; text-align: center; max-width: 400px;">
      <h2 style="color: ${winnerTeam === 'RED' ? '#e74c3c' : '#3498db'}; margin-bottom: 20px;">
        🎉 VICTORIA para el equipo ${winnerTeam}
      </h2>
      <p style="font-size: 1.2rem; margin-bottom: 30px;">
        ${myTeam === winnerTeam ? '¡Felicidades!' : 'El oponente se ha rendido'}
      </p>
      <button onclick="window.location.href='lobby.html'" style="padding: 10px 30px; background: #27ae60; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer;">
        Volver al Lobby
      </button>
    </div>
  `;

  document.body.appendChild(modal);
  GAME_STATE.winner = winnerTeam;
}





// --- LOGICA DE GUARDADO/CARGADO PARA STRATEGO ---

const STORAGE_KEY = 'stratego_setups';
const btnGuardar = document.getElementById('btn-guardar');
const btnCargar = document.getElementById('btn-cargar');

// 1. FUNCION: obtener estado actual del tablero
function obtenerAlineacionActual() {
  const alineacion = [];

  // recorremos la matriz 10x10
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const celda = board.matrix[row][col];

      // si hay una pieza y es de mi equipo la guardamos
      if (celda && typeof celda === 'object' && celda.team === myTeam) {
        alineacion.push({
          rank: celda.rank,
          row: row,
          col: col
        });
      }
    }
  }
  return alineacion;
}

// 2. FUNCION: restaurar posiciones en la matriz
function restaurarAlineacion(datosGuardados) {
  // solo permitir cargar si estamos en fase de preparacion
  if (GAME_STATE.phase !== 'SETUP') {
    alert("no puedes cargar una alineacion con el juego empezado.");
    return;
  }

  // 1. limpiamos el tablero actual (usando tu funcion existente)
  limpiarTablero();

  // 2. colocamos las piezas guardadas
  datosGuardados.forEach(dato => {
    // creamos una nueva instancia de Piece en la posicion guardada
    board.matrix[dato.row][dato.col] = new Piece(dato.rank, myTeam);
  });

  // 3. renderizamos para que se vean los cambios
  renderer.render(board.matrix);

  // actualizamos el mensaje del inventario
  document.getElementById('inventory').innerHTML = '<p style="color: #2ecc71;">✅ alineacion cargada</p>';
  alert("¡alineacion cargada con exito!");
}

// --- EVENTO GUARDAR ---
btnGuardar.addEventListener('click', () => {
  // validar fase
  if (GAME_STATE.phase !== 'SETUP') {
    alert("solo puedes guardar alineaciones durante la fase de preparacion.");
    return;
  }

  const nombreAlineacion = prompt("ponle un nombre a esta estrategia (ej: defensa Minera):");
  if (!nombreAlineacion) return;

  const alineacion = obtenerAlineacionActual();

  // validar que haya piezas para guardar
  if (alineacion.length === 0) {
    alert("el tablero esta vacio o no tienes piezas colocadas.");
    return;
  }

  let guardadas = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  guardadas[nombreAlineacion] = alineacion;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(guardadas));

  alert(`estrategia "${nombreAlineacion}" guardada.`);
});

// --- EVENTO CARGAR ---
btnCargar.addEventListener('click', () => {
  if (GAME_STATE.phase !== 'SETUP') {
    alert("ya no puedes cambiar la alineacion, la batalla ha comenzado.");
    return;
  }

  const guardadas = JSON.parse(localStorage.getItem(STORAGE_KEY));

  if (!guardadas || Object.keys(guardadas).length === 0) {
    alert("no tienes estrategias guardadas.");
    return;
  }

  const nombres = Object.keys(guardadas).join('\n');
  const seleccion = prompt(`escribe el nombre de la estrategia a cargar:\n\n${nombres}`);

  if (seleccion && guardadas[seleccion]) {
    restaurarAlineacion(guardadas[seleccion]);
  } else if (seleccion) {
    alert("no encontre esa estrategia.");
  }
});
