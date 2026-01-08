//importacion de los rangos de las piezas y los datos correspondientes al tablero
import { PIECE_RANKS, BOARD_CONFIG } from '../../utils/constants.js';
/**
 * verifica si un movimiento es valido segun las reglas de stratergo
 * @param {Object} boardObj -la instancia de la clase board
 * @param {Object} start -coordenadas de inicio {row, col}
 * @param {Object} end -coordenadas de destino {row, col}
 * @param {Object} piece -la pieza que se mueve
 * @returns {Object} 
 */
//funcion que 
export function validateMove(boardObj, start, end, piece) {
  const { matrix } = boardObj;
  //condicion para delimitar los limites del mapa
  if (end.row < 0 || end.row >= BOARD_CONFIG.ROWS || end.col < 0 || end.col >= BOARD_CONFIG.COLUMNS) {
    return { valid: false, message: 'movimiento invalido' };
  }
  //condicion para que no cuente como movimiento moverse en la casilla actual
  if (start.row === end.row && start.col === end.col) {
    return { valid: false, message: 'Mueva la tropa/pieza a otra casilla' };
  }
  //condicion para saber si la pieza que se quiere mover no es una bomba o una bandera
  if (piece.rank === PIECE_RANKS.BOMB || piece.rank === PIECE_RANKS.FLAG) {
    return { valid: false, message: 'Esta tropa/pieza no puede moverse' };
  }
  //condicion para prohibir que una pieza no ocupe el mismo lugar que una pieza aliada
  const targetCell = matrix[end.row][end.col];
  if (targetCell && typeof targetCell === 'object' && targetCell.team === piece.team) {
    return { valid: false, message: 'No puedes ocupar esa casilla. Hay una tropa/pieza ahi' };
  }

  //condicion para delimitar los lagos
  if (targetCell === 'LAKES') {
    return { valid: false, message: 'No puedes moverte en un lago' };
  }
  // constantes para definir las capacidades de movimiento:
  // arriba, abajo, izquierda y derecha
  const deltaRow = Math.abs(end.row - start.row);//usamos MATH.abs para siempre tener el valor positivo
  const deltaCol = Math.abs(end.col - start.col);
  // condicion que verifica que no haya movimientos diagonales
  if (deltaRow > 0 && deltaCol > 0) {
    return { valid: false, message: 'Solo te puedes desplazar hacia arriba, abajo, izquierda o derecha' };
  }

  //condicional que si la pieza es un explorador, tiene permitido moverse cualquier distancia pero sin saltar obstaculos
  if (piece.rank === PIECE_RANKS.SCOUT) {
    return validateScoutPath(matrix, start, end, deltaRow, deltaCol);
  } else {
    // si es otra pieza solo se mueve una casilla a la vez
    if (deltaRow > 1 || deltaCol > 1) {
      return { valid: false, message: 'Esta pieza solo puede moverse 1 casilla a la vez' };
    }
  }
  return { valid: true };
}

function validateScoutPath(matrix, start, end, deltaRow, deltaCol) {
  //determina direccion del paso
  const stepRow = end.row > start.row ? 1 : (end.row < start.row ? -1 : 0);
  const stepCol = end.col > start.col ? 1 : (end.col < start.col ? -1 : 0);
  let currentRow = start.row + stepRow;
  let currentCol = start.col + stepCol;

  // ciclo para recorrer las casillas del medio del tablero
  while (currentRow !== end.row || currentCol !== end.col) {
    const cellContent = matrix[currentRow][currentCol];

    // condicion para saber si hay algo en el camino como una casilla de lago o una pieza y bloquea
    if (cellContent !== null) {
      return { valid: false, message: 'El camino esta bloqueado' };
    }
    currentRow += stepRow;
    currentCol += stepCol;
  }
  return { valid: true };
}

/**
 * Resuelve el combate entre dos piezas
 * @param {Object} attacker pieza atacante.
 * @param {Object} defender pieza defensora.
 * @returns {string} 'ATTACKER' | 'DEFENDER' | 'DRAW'
 */
//funcion para la logica de los combates
export function resolveCombat(attacker, defender) {
  console.log(`Pelea: ${attacker.rank} vs ${defender.rank}`);

  //espia mata al mariscal 
  if (attacker.rank === 10 && defender.rank === 1) return 'ATTACKER';

  //minero desactiva bomba 
  if (attacker.rank === 8 && defender.rank === 11) return 'ATTACKER';

  //bomba mata a cualquiera (menos al minero)
  if (defender.rank === 11) return 'DEFENDER';

  //captura de bandera
  if (defender.rank === 0) {
    alert('¡VICTORIA! Capturaste la bandera');
    return 'ATTACKER';
  }

  if (attacker.rank < defender.rank) return 'ATTACKER';
  if (attacker.rank > defender.rank) return 'DEFENDER';
  return 'DRAW'; // empate
}
