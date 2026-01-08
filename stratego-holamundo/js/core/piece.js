//traemos los datos de las piezas 
import { PIECE_RANKS } from "../../utils/constants.js";
//se crea una clase que utilice las propiedades de cada píeza
export class Piece {
  constructor(rank, team) {
    this.rank = rank; //Los rangos de las piezas
    this.team = team;//jugador 1 o jugador 2 (rojo o azul)
    this.isRevealed = false;//Si la pieza ya se ha revelado
    this.isAlive = true;//Si la pieza esta con vida
  }
  //reglas del juego
  //metodo para moverse y para saber si la pieza es una bomba o una bandera
  move() {
    if (this.rank === PIECE_RANKS.BOMB || this.rank === PIECE_RANKS.FLAG) {
      return false;
    }
    return true;
  }
  getSymbol() {
    return this.rank;
  }
}


