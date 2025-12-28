//se importan las propiedades del tablero 
import { BOARD_CONFIG } from '../../utils/constants.js';
//se crea una clase que utilice las propiedades del tablero
export class Board {
  constructor() {
    //Inicializamos constructor para que acepate una matriz y inicialice el tablero
    this.matrix = [];
    this.initializeBoard();
  }

  //metodo para hacer una matriz 10x10, cada casilla es null
  initializeBoard() {
    const lakeSet = new Set(BOARD_CONFIG.LAKES);//variable que tiene los datos de las casillas de los lagos
    for (let i = 0; i < BOARD_CONFIG.ROWS; i++) {
      const row = [];
      for (let j = 0; j < BOARD_CONFIG.COLUMNS; j++) {
        if (lakeSet.has(`${i},${j}`)) {   //si encuentra un numero de casilla que sea igual a las que estan en la seccion de lagos, entonces las nombra como tal 
          row.push(`LAKES`);
        } else {
          row.push(null);
        }
      }
      this.matrix.push(row);
    }
  }


}
