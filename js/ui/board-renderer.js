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

          // --- AQUÍ ESTÁ LA NUEVA LÓGICA DE NEBLINA ---
          if (cellContent.team !== myTeam && !cellContent.isRevealed) {
            // CASO 1: Es enemigo y no ha peleado -> Mostramos NEBLINA
            pieceElement.innerText = '?';
            pieceElement.classList.add('fog');
            // Quitamos el color del equipo para que sea totalmente gris
            pieceElement.classList.remove(cellContent.team.toLowerCase());
          } else {
            // CASO 2: Es mi pieza O ya fue descubierta -> Mostramos RANGO
            pieceElement.innerText = cellContent.getSymbol();
          }

          // SOLO hacer draggable si es TU pieza
          if (cellContent.team === myTeam) {
            pieceElement.draggable = true;
            pieceElement.addEventListener('dragstart', (e) => {
              // ... (tu código existente de dragstart)
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
