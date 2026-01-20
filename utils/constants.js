//constante que contiene los rangos y nombres de las piezas del juego
export const PIECE_RANKS = {
  MARSHAL: 1,
  GENERAL: 2,
  COLONEL: 3,
  MAJOR: 4,
  CAPTAIN: 5,
  LIEUTENANT: 6,
  SERGEANT: 7,
  MINER: 8,
  SCOUT: 9,
  SPY: 10,
  BOMB: 11,
  FLAG: 0,
  HIDDEN: -1 //cuando una pieza esta oculta el valor de la neblina que la cubre es -1
};

//constante con todos los datos correspondientes al tablero
export const BOARD_CONFIG = {
  // filas y columnas 10x10
  ROWS: 10, COLUMNS: 10,
  // las casillas que cubren los dos lagos
  LAKES: ['4,2', '4,3', '5,2', '5,3',//lago de la izquierda
    '4,6', '4,7', '5,6', '5,7'] //lago de la derecha
};

//constante que guarda todos los datos correspondientes a la api contract 
export const API_CONFIG = {
  //url de la api
  API_URL: 'https://stratego-api.koyeb.app',
  //url para crear la sala
  CREATE_ROOM: 'https://stratego-api.koyeb.app/api/match-making/create-room',
  //url para moverse 
  MOVE: 'https://stratego-api.koyeb.app/api/match/move'
};

// constante para ahorrase el escribir MOVE_PIECE a cada radto
export const ACTION = {
  MOVE: 'MOVE_PIECE'
};





