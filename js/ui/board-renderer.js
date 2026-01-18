//clase export para que cualquiero otro archivo del documento pueda usarla
export class BoardRenderer {
  constructor(htmlId) {
    this.boardElement = document.getElementById(htmlId)//boardElement recibe el div de id board del index.html
  }
  //funtcion que toma la matriz y le añade el estilo css a cada una de las celdas correspondiente
render(matrix) {
  this.boardElement.innerHTML = '';
  const myTeam = localStorage.getItem('myTeam');
  
  matrix.forEach((row, rowIndex) => {
    row.forEach((cellContent, colIndex) => {
      const cellDiv = document.createElement('div');
      cellDiv.classList.add('cell');
      cellDiv.dataset.row = rowIndex;
      cellDiv.dataset.col = colIndex;

      if (cellContent === 'LAKES') {
        cellDiv.classList.add('lake');
      } else if (cellContent !== null && typeof cellContent === 'object') {
        const pieceElement = document.createElement('div');
        pieceElement.classList.add('piece');
        pieceElement.classList.add(cellContent.team.toLowerCase());
        
        // ocultar piezas enemigas no reveladas
        if (cellContent.team !== myTeam && !cellContent.isRevealed) {
          pieceElement.innerText = '?';
        } else {
          pieceElement.innerText = cellContent.getSymbol();
        }
        
        // SOLO hacer draggable si es TU pieza
        if (cellContent.team === myTeam) {
          pieceElement.draggable = true;
          pieceElement.addEventListener('dragstart', (e) => {
            console.log('🔥 DRAGSTART activado para pieza en', rowIndex, colIndex);
            e.dataTransfer.setData('text/plain', JSON.stringify({
              source: 'board',
              fromRow: rowIndex,
              fromCol: colIndex
            }));
          });
        }
        
        cellDiv.appendChild(pieceElement);
      }
      
      this.boardElement.appendChild(cellDiv);
    });
  });
}


}