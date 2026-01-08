### stratego-holamundo
Proyecto de recrear el juego estratego en la web usando web sockets y api fetch en html, css y js vanilla. Para la materia POW por los integrantes de HolaMundo

### Integantes:
-Orlando Valdez
-Jenry Youssef
-Oscar Torres

Estructura de archivos
stratego-holamundo/
│
├── 📄 README.md                 # Documentacion
├── 📄 index.html                # Pagina principal HTML
│
├── 📂 assets/                   # Imagenes y sonidos
│
├── 📂 styles/                   # Estilos CSS
│   ├── 📄 base.css              
│   ├── 📄 board.css             
│   ├── 📄 components.css        
│   └── 📄 lobby.css             
│
└── 📂 js/                       # Logica
    │
    ├── 📄 main.js               
    │
    ├── 📂 core/                 # Logica de Negocio js
    │   ├── 📄 board.js
    │   ├── 📄 piece.js
    │   └── 📄 rules.js
    │
    ├── 📂 services/             # Red y conexiones js
    │   ├── 📄 fetch-api.js
    │   ├── 📄 server-side-events.js
    │   ├── 📄 socket.js
    │   └── 📄 transport-selector.js
    │
    ├── 📂 state/                # Estado js
    │   ├── 📄 match.js
    │   ├── 📄 session.js
    │   └── 📄 storage.js
    │
    ├── 📂 ui/                   # Vista js
    │   ├── 📄 board-renderer.js
    │   ├── 📄 drag-drop.js
    │   ├── 📄 lobby-ui.js
    │   ├── 📄 modal-ui.js
    │   └── 📄 navigation.js
    │
    └── 📂 utils/                # Utilidades js
        └── 📄 constants.js      # Configuraciones globales


### ¿Como probar el juego?
1. Descagar el contenido del repositorio
2. Instalar la extension Live Server
3. Abrir el archivo `index.html` con Live Server (Extensión de VS Code).

### 1. El Tablero (`core/board.js`)
El tablero se representa como una matriz de 10x10. Cada celda de la matriz puede contener tres tipos de valores:
* `null`: Casilla vacía (tierra transitable)
* `"LAKES"`: String constante que representa obstaculos de agua (no transitables)
* `Piece Object`: Instancia de la clase `Piece` representando una unidad

### 2. Las Piezas (`core/piece.js`)
Cada unidad es un objeto con propiedades de estado:
* `rank`: Valor numerico (1-10, Bomba, Bandera)
* `team`: Equipo ('RED' o 'BLUE')
* `isRevealed`: Para logica "Niebla de Guerra" (Todavia falta por implementarse)

### 3. Motor de Reglas (`core/rules.js`)
Este archivo contiene todas las reglas relacionadas con el gameplay implementadas en las siguientes funciones:

* **`validateMove(board, start, end, piece)`:**
    * Verifica limites del tablero
    * Calcula que las piezas se puedan mover arriba, abajo, izquierda y derecha
    * Verifica rango de movimiento (1 casilla para las normales, ilimitado para exploradores)
    * Detecta colisiones con lagos o piezas propias
    * Impide mover bombas o banderas

* **`resolveCombat(attacker, defender)`:**
    * Implementa el quien le gana a quien
    * Devuelve: `'ATTACKER'`, `'DEFENDER'` o `'DRAW'`

## Renderizado y UI (`ui/board-renderer.js`)

1.  El `BoardRenderer` recibe la matriz actualizada
2.  Limpia el contenedor HTML
3.  Itera sobre la matriz y genera elementos `<div>` dinamicamente
4.  Asigna clases CSS (`.lake`, `.piece`, `.blue`) segun el contenido
Esto asegura que lo que ve el usuario siempre esté sincronizado al 100% con la matriz de datos

## Interacción (Drag & Drop API)
La interaccion se maneja en `main.js` utilizando la API Drag and Drop.

1.  **DragStart:** Se guardan los datos de la pieza (`rank`, `team`, `coords`) en un objeto json y se guardan en `dataTransfer`
2.  **Drop:**
    * Se recuperan las coordenadas de destino mediante `dataset.row` y `dataset.col` del HTML
    * Se ejecuta `validateMove()`
    * Si es valido:
        * Si la casilla destino está vacia -> Mueve
        * Si hay un enemigo -> Ejecuta `resolveCombat()`
    * Finalmente, se actualiza la matriz y se invoca `renderer.render()`

## Configuración Global (`utils/constants.js`)
Para facilitar el mantenimiento de los datos mas importantes para el juego y la implementacion de las APIs:
* **`PIECE_RANKS`:** nombres y valores numericos
* **`BOARD_CONFIG`:** Define dimensiones y ubicacion de los lagos
* **`API_CONFIG`:** Endpoints 

