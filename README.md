### stratego-holamundo
Proyecto de recrear el juego estratego en la web usando web sockets y api fetch en html, css y js vanilla. Para la materia POW por los integrantes de HolaMundo

### Integantes:
* Orlando Valdez
* Jenry Youssef
* Oscar Torres

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




## Etapa I: Lobby y Comunicación WebSocket (Completado)

### Arquitectura de Red
El proyecto implementa un sistema de comunicación dual según las especificaciones del proyecto:
* **WebSocket**: Para eventos en tiempo real (chat global, actualizaciones de lobby)
* **REST API + SSE**: Para operaciones CRUD y notificaciones asíncronas

### Archivos Implementados

#### 1. Sistema de Red (`js/network/websocket-manager.js`)
Gestor centralizado de conexiones WebSocket que maneja:
* Conexión persistente al gateway: `wss://stratego-api.koyeb.app/gateway?userId={uuid}`
* Sistema de eventos con callbacks registrables
* Envío y recepción de mensajes en formato JSON
* Manejo de eventos: `lobby_update`, `lobby_chat_message`, `challenge_received`, `challenge_answered`

#### 2. Interfaz de Lobby (`lobby.html`)
Pantalla principal del "Club de Oficiales" dividida en:
* **Panel de Login**: Validación de nombres (3-30 caracteres, alfanuméricos)
* **Lista de Usuarios**: Muestra jugadores conectados y el bot "Mariscal Autómata"
* **Chat Global**: Comunicación en tiempo real vía WebSocket
* **Panel de Acciones**: Opciones para retos PvP y modo PvE

#### 3. Lógica de Lobby (`js/lobby-main.js`)
Controlador que integra:
* **Registro de usuarios**: `POST /api/sessions` con validación de formato
* **Gestión de presencia**: Actualización automática vía `lobby_update`
* **Chat global**: Envío con formato `{event: 'send_lobby_chat', data: {content: '...'}}`
* **Sistema de retos**: Selección aleatoria de `protocolMode` (FETCH_FIRST/SOCKET_FIRST)
* **Logout**: `DELETE /api/sessions/current` con desconexión limpia del WebSocket

#### 4. Estilos (`styles/lobby.css`)
Diseño responsivo con:
* Layout de 3 columnas usando CSS Grid
* Tema oscuro con acentos dorados (#D1BD43)
* Efectos hover y transiciones
* Modal para notificaciones de retos
* Scrollbars personalizadas

### Funcionalidades Operativas
✅ Login con validación de nombre único  
✅ Conexión WebSocket automática tras registro  
✅ Lista dinámica de usuarios (actualización en tiempo real)  
✅ Chat global broadcast funcionando  
✅ Selección de oponentes con indicador visual  
✅ Sistema de retos PvP con configuración de modo (Guerra Clásica/Duelo Rápido)  
✅ Opción de entrenamiento contra bot (PvE)  
✅ Logout con limpieza de recursos  

### Próximos Pasos
- [ ] Implementar Etapa II: Setup (colocación de piezas)
- [ ] Integrar sistema de retos con transición a pantalla de juego
- [ ] Implementar SSE para eventos cuando `protocolMode === 'FETCH_FIRST'`

### ¿Cómo probar el Lobby?
1. Abrir `lobby.html` con Live Server
2. Ingresar un nombre de usuario válido
3. Probar el chat global enviando mensajes
4. Abrir otra pestaña/navegador con diferente usuario para ver comunicación en tiempo real
