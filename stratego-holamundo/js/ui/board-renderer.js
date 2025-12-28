//Clase export para que cualquiero otro archivo del documento pueda usarla
export class BoardRenderer {
  constructor(htmlId) {
    this.boardElement = document.getElementById(htmlId)//boardElement recibe el div de id board del index.html
  }
  //funtcion que toma la matriz y le añade el estilo css a cada una de las celdas correspondiente
  render(matrix) {
    this.boardElement.innerHTML = '';//borra todo el contenido de la etiqueta
    //ciclos para recorrer la matriz
    matrix.forEach(row => {
      row.forEach(cellContent => {

        const cellElement = document.createElement('div');//Crea una nueva etiqueta div   
        cellElement.classList.add('cell');//le añade al nuevo div el estilo basico de una celda
        if (cellContent === 'LAKES') {

          cellElement.classList.add('lake');//Si es LAKES entonces le aplica el estilo de los lagos
        } else if (cellContent && typeof cellContent === 'object') {//si es una pieza se pinta

          const pieceElement = document.createElement('div');//Crea una etiqueta div pero para la pieza
          pieceElement.classList.add('piece');//Le añade al nuevo div el estilo de la pieza
          if (cellContent.team === 'BLUE') pieceElement.classList.add('blue');//si toco el equipo azul, le pone el estilo azul
          pieceElement.innerText = cellContent.getSymbol(); // Muestra el rango
          cellElement.appendChild(pieceElement);
        }
        this.boardElement.appendChild(cellElement);//lo anida al div que ya esta en el index.html
      });
    });
  }
}
