# stratego-holamundo

proyecto para recrear el juego stratego en la web usando websockets y api fetch con html, css y js puro (vanilla). esto es para la materia pow, hecho por el team holamundo.

### integrantes
* orlando valdez
* jenry youssef
* oscar torres

### instalacion de dependencias
para que el servidor funcione (el archivo `server.js`), necesitas tener node.js instalado.
abre una terminal en la carpeta del proyecto y corre este comando para bajar las librerias necesarias (`ws` para los sockets y `uuid` para los ids):

```bash
npm install ws uuid

### ¿como probar el juego?
1. descarga el repo
2. instala la extension live server en vscode
3. abre el archivo `index.html` (o `lobby.html` para ver lo nuevo) con live server.

---

## explicacion del codigo

### 1. el tablero (`core/board.js`)
el tablero es basicamente una matriz de 10x10. cada celda puede tener tres cosas:
* `null`: vacio, se puede caminar
* `"LAKES"`: obstaculos de agua, por ahi no se pasa
* `Piece Object`: una instancia de la clase `piece`, o sea una unidad

### 2. las piezas (`core/piece.js`)
cada unidad es un objeto con esto:
* `rank`: numero del 1 al 10, o si es bomba/bandera
* `team`: equipo 'red' o 'blue'
* `isRevealed`: para la logica de niebla de guerra (esto falta pulirlo)

### 3. reglas del juego (`core/rules.js`)
aqui metimos toda la logica del gameplay:
* **`validatemove`**: checa que no te salgas del tablero, valida movimientos arriba/abajo/lados, el rango (1 casilla o infinito si es explorador), y que no choques con lagos o tus propias fichas. tambien bloquea bombas y banderas.
* **`resolvecombat`**: define quien le gana a quien en los pvp y regresa si gana el atacante, el defensor o si hubo empate.

### 4. renderizado y ui (`ui/board-renderer.js`)
1. el `boardrenderer` recibe la matriz
2. limpia el html
3. hace un ciclo sobre la matriz y crea los `<div>` dinamicamente
4. le pone las clases css (`.lake`, `.piece`, etc)
asi aseguramos que lo que ves en pantalla es lo que realmente esta en los datos.

### 5. interaccion (drag & drop)
todo esto esta en `main.js` usando la api nativa:
* **dragstart:** guardamos rank, team y coordenadas en el json del `datatransfer`.
* **drop:** agarramos las coordenadas donde soltaste la ficha, corremos `validatemove()` y si pasa, movemos la ficha. si hay enemigo, se llama a `resolvecombat()`. al final actualizamos matriz y renderizamos.

### 6. config global (`utils/constants.js`)
aqui guardamos lo importante para no tener numeros magicos regados: rangos de piezas, donde estan los lagos y los endpoints de la api.

---

## etapa 1: lobby y websockets (lo nuevo)

### como funciona la red
le metimos un sistema dual como pedia el proyecto:
* **websocket**: para todo lo real-time (chat, updates del lobby)
* **rest api + sse**: para loguearse y cosas asincronas

### archivos nuevos

#### 1. red (`js/network/websocket-manager.js`)
aqui controlamos el websocket. se conecta al gateway de la materia, maneja eventos con callbacks y manda/recibe los json para el chat y los retos.

#### 2. el lobby (`lobby.html`)
la pantalla del "club de oficiales". tiene el login (valida nombres), la lista de conectados (incluyendo al bot mariscal), el chat global y los botones para retar gente.

#### 3. logica del lobby (`js/lobby-main.js`)
el cerebro del lobby. hace el post para registrarte, actualiza quien esta conectado, manda mensajes al chat y maneja lo de los retos (elije el modo fetch o socket al azar). tambien tiene el logout para cerrar sesion limpio.

#### 4. estilos (`styles/lobby.css`)
diseño grid de 3 columnas, modo oscuro con detalles dorados y scrollbars personalizadas. se ve bastante bien.

### que funciona hasta ahora
✅ login (valida que el nombre no se repita)
✅ se conecta solo al websocket al entrar
✅ lista de usuarios en tiempo real
✅ chat global funcionando
✅ indicador visual para retar oponentes
✅ retos pvp (clasico o rapido)
✅ modo pve contra el bot
✅ logout

### lo que falta
- [ ] jugar con bot
- [ ] chat 1 vs 1 
- [ ] implementar sse para cuando toque modo `fetch_first`

### ¿como probar el lobby?
1. abre `lobby.html` con live server
2. pon un nombre valido
3. prueba mandar mensajes en el chat
4. abre otra pestaña con otro nombre y ve como se actualiza todo en tiempo real