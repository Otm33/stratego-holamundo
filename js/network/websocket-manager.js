/**
 * gestor centralizado de conexiones WebSocket para Stratego
 * maneja la conexion, envio y recepcion de mensajes del servidor
 */

export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.userId = null;
        this.username = null;
        
        // callbacks que otros modulos pueden registrar
        this.eventHandlers = {
            lobby_update: [],
            lobby_chat_message: [],
            challenge_received: [],
            challenge_answered: [],
            match_started: [],
            opponent_moved: [],
            combat_result: [],
            match_chat_message: [],
            illegal_move_detected: [],
            game_over: [],
            rematch_started: [],
            match_cancelled: []
        };
    }

    /**
     * conecta al servidor WebSocket
     * @param {string} userId - el ID del usuario obtenido del registro
     * @param {string} username - el nombre del usuario
     */
    connect(userId, username) {
        if (this.isConnected) {
            console.warn('ya existe una conexion WebSocket activa');
            return;
        }

        this.userId = userId;
        this.username = username;

        // conexion al gateway de WebSockets
        this.socket = new WebSocket(`wss://stratego-api.koyeb.app/gateway?userId=${userId}`);

        // evento: Conexion exitosa
        this.socket.onopen = () => {
            this.isConnected = true;
            console.log('WebSocket CONECTADO - estado:', this.socket.readyState);
            
            // enviar identificacion al servidor
            this.sendIdentification();
        };

// evento: Mensaje recibido del servidor
this.socket.onmessage = (event) => {
    console.log('MENSAJE DEL SERVIDOR:', event.data);
    console.log('========== MENSAJE RECIBIDO ==========');
    console.log('Datos crudos:', event.data);
    console.log('Tipo:', typeof event.data);
    
    //  userId actual
    console.log('mi serId:', this.userId);
    
    try {
        const data = JSON.parse(event.data);
        console.log('mensaje parseado:', data);
        
        // si es challenge_received, mostrar a quien va dirigido
        if (data.event === 'challenge_received') {
            console.log('🚨🚨🚨 RETO RECIBIDO 🚨🚨🚨');
            console.log('para:', data.data?.challenged?.userId || 'desconocido');
        }
        
        this.handleIncomingMessage(data);
    } catch (error) {
        console.error(' error al parsear mensaje WebSocket:', error);
        console.log('contenido que fallo:', event.data);
    }
    
    console.log('========================================');
};



        // evento: Error en la conexion
        this.socket.onerror = (error) => {
            console.error(' error en WebSocket:', error);
        };

        // evento: Conexion cerrada
        this.socket.onclose = () => {
            this.isConnected = false;
            console.log('conexion WebSocket cerrada');
        };
    }

/**
 * envia la identificacion del usuario al servidor
 * (si el servidor lo requiere al conectar)
 */
sendIdentification() {
    // el userId ya esta en la URL del WebSocket
    // no se necesita mensaje extra de autenticacion
    console.log(`usuario conectado al WebSocket: ${this.username} (${this.userId})`);
}


    /**
     * registra un callback para un tipo de evento especifico
     * @param {string} eventType - tipo de evento (ej: 'lobby_chat_message')
     * @param {Function} callback - funcion a ejecutar cuando llegue el evento
     */
    on(eventType, callback) {
        if (this.eventHandlers[eventType]) {
            this.eventHandlers[eventType].push(callback);
        } else {
            console.warn(`tipo de evento desconocido: ${eventType}`);
        }
    }

/**
 * distribuye los mensajes entrantes a los handlers correspondientes
 * @param {Object} data - datos del mensaje recibido
 */
handleIncomingMessage(data) {

    console.log('🔍 DEBUG handleIncomingMessage:', data);

    let eventType = null;
    let payload = null;

    // detectar el formato
    if (data.event && data.payload) {
        // formato: { event: 'nombre', payload: {...} }
        eventType = data.event;
        payload = data.payload;
    } else if (data.event && data.data) {
        // FORMATO DEL SERVIDOR: { event: 'nombre', data: {...} }
        eventType = data.event;
        payload = data.data;
    } else if (data.type) {
        // formato: { type: 'nombre', ...resto }
        eventType = data.type;
        payload = data;
    } else {
        console.warn('mensaje sin formato reconocido:', data);
        return;
    }

    if (!eventType) {
        console.warn('mensaje sin tipo de evento:', data);
        return;
    }

    console.log(`evento detectado: "${eventType}"`, payload);

    // ejecutar callbacks
    if (this.eventHandlers[eventType]) {
        this.eventHandlers[eventType].forEach(callback => {
            callback(payload);
        });
    } else {
        console.warn(`no hay handlers para el evento: ${eventType}`);
    }
}


sendLobbyChat(content) {
    console.log('DEBUG sendLobbyChat llamado');
    console.log('isConnected:', this.isConnected);
    console.log('socket:', this.socket);
    console.log('content:', content);

    if (!this.isConnected) return;

const message = {
    event: 'send_lobby_chat',
    data: {  
        content: content,
    }
}



    console.log('enviando mensaje:', message);
    console.log('stringified:', JSON.stringify(message));
    
    try {
        this.socket.send(JSON.stringify(message));
        console.log('mensaje enviado exitosamente');
    } catch (error) {
        console.error('error al enviar mensaje:', error);
    }
}





    /**
     * envia un mensaje al chat privado de la partida
     * @param {string} matchId - ID de la partida actual
     * @param {string} content - contenido del mensaje
     */
    sendMatchChat(matchId, content) {
        if (!this.isConnected) {
            console.error('no hay conexion WebSocket');
            return;
        }

        const message = {
            event: 'send_match_chat',
            payload: {
                matchId: matchId,
                content: content
            }
        };

        this.socket.send(JSON.stringify(message));
    }

    /**
     * cierra la conexion WebSocket
     */
    disconnect() {
        if (this.socket && this.isConnected) {
            this.socket.close();
            this.isConnected = false;
            console.log('Desconectado del servidor');
        }
    }
}
