//se importan las clases correspondientes al tablero
import { Board } from './core/board.js';
import { BoardRenderer } from './ui/board-renderer.js';
import { Piece } from './core/piece.js';
import { PIECE_RANKS } from '../utils/constants.js';
// eeste evento DOMContentLoaded es para esperar que todo el html cargue antes de ejecutar este listener
document.addEventListener('DOMContentLoaded', () => {
  const board = new Board(); //se crea un nuevo tablero
  const renderer = new BoardRenderer('board'); //se crea un nuevo renderizador 
  renderer.render(board.matrix);//Renderizamos el tablero nuevo con su matriz

  const inventoryElement = document.getElementById('inventory');//Se toma la etiqueta del inventario

  const createArmy = (team) => {
    const army = [];

    //fucion que llena el array con las piezas
    const add = (count, rank) => {
      for (let i = 0; i < count; i++) {
        army.push(new Piece(rank, team));
      }
    };

    //Llamada para agregar a todas las piezas
    add(1, PIECE_RANKS.MARSHAL);
    add(1, PIECE_RANKS.GENERAL);
    add(2, PIECE_RANKS.COLONEL);
    add(3, PIECE_RANKS.MAJOR);
    add(4, PIECE_RANKS.CAPTAIN);
    add(4, PIECE_RANKS.LIEUTENANT);
    add(4, PIECE_RANKS.SERGEANT);
    add(5, PIECE_RANKS.MINER);
    add(8, PIECE_RANKS.SCOUT);
    add(1, PIECE_RANKS.SPY);
    add(6, PIECE_RANKS.BOMB);
    add(1, PIECE_RANKS.FLAG);

    return army;
  };

  const myPieces = createArmy('RED');
  myPieces.forEach((piece) => {
    const pieceDiv = document.createElement('div');
    //ciclo que recorre la lista de piezas, crea un div nuevo por cada pieza y les pone estilo, en este caso el rojo de la pieza basica
    pieceDiv.classList.add('piece');
    pieceDiv.innerText = piece.getSymbol();
    pieceDiv.draggable = true; // propiedad para poder usar el drag and drop

    //evento para poder arrastrar las piezas
    pieceDiv.addEventListener('dragstart', (e) => {
      // guarda los datos de la pieza en texto plano para poder transportarla con ella, usando dataTransfer
      e.dataTransfer.setData('text/plain', JSON.stringify({
        rank: piece.rank,
        team: piece.team,
        source: 'inventory' // Para saber que viene de afuera
      }));
    });

    inventoryElement.appendChild(pieceDiv);
  });

  //se toma la etiqueta del tablero
  const boardContainer = document.getElementById('board');

  //listener para que no se bloquee el drop de la pieza sobre la casilla (el navegador por defecto lo bloquea)
  boardContainer.addEventListener('dragover', (e) => {
    e.preventDefault();//La linea para que no bloquee el drop
  });

  //evento para poder soltar la pieza
  boardContainer.addEventListener('drop', (e) => {
    e.preventDefault();

    // identificamos en que celda cayo el mouse (usando e.target)
    const cell = e.target.closest('.cell');

    if (!cell) return; // Si solto la pieza fuera de una celda, ignorar

    //se calculan las coordenadas x, y basandonos en los hijos del tablero
    const index = Array.from(boardContainer.children).indexOf(cell);
    const row = Math.floor(index / 10);
    const col = index % 10;

    // Recuperamos los datos de la pieza que guardamos en 'dragstart'
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));

    console.log(`Soltado en fila ${row}, col ${col}`);

    //condicion que prohibe colocar piezas en los lagos
    if (board.matrix[row][col] === 'LAKES') {
      alert('¡No puedes colocar tropas/piezas en los lagos!');
      return;
    }

    if (row < 6) {
      alert('Solo puedes colocar tropas/piezas en las primeras 4 filas de abajo del tablero');
      return;
    }

    //se inserta una nueva pieza dentro de la matriz
    const newPiece = new Piece(data.rank, data.team);
    board.matrix[row][col] = newPiece;

    //Se vuelve a renderizar el tablero
    renderer.render(board.matrix);
  });
});

