const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`Servidor WebSocket corriendo en ws://localhost:${PORT}`);

const matches = {};

wss.on('connection', ws => {
    console.log('Cliente conectado');

    ws.on('message', message => {
        let data;
        try { data = JSON.parse(message); } catch { return; }

        const { action, matchId, userId, team } = data;

        if (!matches[matchId]) matches[matchId] = { players: [], ready: {}, boardState:{} };
        const match = matches[matchId];
        if (!match.players.includes(ws)) match.players.push(ws);

        switch(action){
                case 'SETUP_COMPLETE':
                    match.ready[userId] = true;
                    match.boardState[userId] = data.pieces || {};

                    //avisar al oponente que yo termine
                    match.players.forEach(p => {
                        if (p !== ws && p.readyState === WebSocket.OPEN) {
                            p.send(JSON.stringify({
                                action: 'OPPONENT_SETUP_COMPLETE',
                                userId,
                                pieces: data.pieces // envia mis piezas al oponente
                            }));
                        }
                    });

                    //buscamos un ID que no sea el mio en el boardState
                    const opponentId = Object.keys(match.boardState).find(id => id !== userId);
                    if (opponentId && match.boardState[opponentId]) {
                        ws.send(JSON.stringify({
                            action: 'OPPONENT_SETUP_COMPLETE',
                            pieces: match.boardState[opponentId] //eecibo las piezas del que ya estaba
                        }));
                    }
                    break;


                case 'MOVE':
                    const { move } = data; // {from:{x,y}, to:{x,y}, result}
                    
                    //logica de actualizacion de estado del server

                    // REENVIAR SOLO AL OPONENTE (no al que envio el mensaje)
                    match.players.forEach(p => {
                        // agregado: p !== ws
                        if (p !== ws && p.readyState === WebSocket.OPEN) {
                            p.send(JSON.stringify({ action: 'OPPONENT_MOVED', move }));
                        }
                    });

                    // detectar captura de bandera (esto si se envía a todos o solo al ganador)
                    const toKey = `${move.to.x},${move.to.y}`;
                    // Nota: aquí deberías verificar el estado real del servidor, 
                    // pero con tu lógica actual confiamos en el cliente.
                    if (move.result === 'ATTACKER_WINS') {
                        // Lógica de bandera...
                    }
                break;

            case 'SURRENDER':
                match.players.forEach(p=>{
                    if(p.readyState===WebSocket.OPEN && p!==ws){
                        p.send(JSON.stringify({ action:'OPPONENT_SURRENDERED', userId }));
                    }
                });
                break;
        }
    });

    ws.on('close', () => console.log('Cliente desconectado'));
});
