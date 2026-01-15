/**
 * Gestor centralizado de conexiones WebSocket para Stratego
 * Maneja la conexión, envío y recepción de mensajes del servidor
 */

export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.userId = null;
        this.username = null;
        
        // Callbacks que otros módulos pueden registrar
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
     * Conecta al servidor WebSocket
     * @param {string} userId - El ID del usuario obtenido del registro
     * @param {string} username - El nombre del usuario
     */
    connect(userId, username) {
        if (this.isConnected) {
            console.warn('Ya existe una conexión WebSocket activa');
            return;
        }

        this.userId = userId;
        this.username = username;

        // Conexión al gateway de WebSockets
        this.socket = new WebSocket(`wss://stratego-api.koyeb.app/gateway?userId=${userId}`);

        // Evento: Conexión exitosa
        this.socket.onopen = () => {
            this.isConnected = true;
            console.log('✅ WebSocket CONECTADO - Estado:', this.socket.readyState);
            
            // Enviar identificación al servidor
            this.sendIdentification();
        };

// Evento: Mensaje recibido del servidor
this.socket.onmessage = (event) => {
    
    //logs
    console.log('📩 MENSAJE DEL SERVIDOR:', event.data);
    console.log('========== MENSAJE RECIBIDO ==========');
    console.log('📦 Datos crudos:', event.data);
    console.log('📦 Tipo:', typeof event.data);
    
    try {
        const data = JSON.parse(event.data);
        console.log('📩 Mensaje parseado:', data);
        
        // Distribuir el mensaje a los handlers registrados
        this.handleIncomingMessage(data);
    } catch (error) {
        console.error('❌ Error al parsear mensaje WebSocket:', error);
        console.log('📦 Contenido que falló:', event.data);
    }
    
    console.log('========================================');
};


        // Evento: Error en la conexión
        this.socket.onerror = (error) => {
            console.error('❌ Error en WebSocket:', error);
        };

        // Evento: Conexión cerrada
        this.socket.onclose = () => {
            this.isConnected = false;
            console.log('🔌 Conexión WebSocket cerrada');
        };
    }

/**
 * Envía la identificación del usuario al servidor
 * (si el servidor lo requiere al conectar)
 */
sendIdentification() {
    // El servidor no requiere identificación manual al conectar
    // La autenticación se hace vía REST API (POST /api/sessions)
    console.log(`✅ Usuario conectado al WebSocket: ${this.username} (${this.userId})`);
}

    /**
     * Registra un callback para un tipo de evento específico
     * @param {string} eventType - Tipo de evento (ej: 'lobby_chat_message')
     * @param {Function} callback - Función a ejecutar cuando llegue el evento
     */
    on(eventType, callback) {
        if (this.eventHandlers[eventType]) {
            this.eventHandlers[eventType].push(callback);
        } else {
            console.warn(`Tipo de evento desconocido: ${eventType}`);
        }
    }

/**
 * Distribuye los mensajes entrantes a los handlers correspondientes
 * @param {Object} data - Datos del mensaje recibido
 */
handleIncomingMessage(data) {
    let eventType = null;
    let payload = null;

    // Detectar el formato
    if (data.event && data.payload) {
        // Formato: { event: 'nombre', payload: {...} }
        eventType = data.event;
        payload = data.payload;
    } else if (data.event && data.data) {
        // 👇 FORMATO DEL SERVIDOR: { event: 'nombre', data: {...} }
        eventType = data.event;
        payload = data.data;
    } else if (data.type) {
        // Formato: { type: 'nombre', ...resto }
        eventType = data.type;
        payload = data;
    } else {
        console.warn('❌ Mensaje sin formato reconocido:', data);
        return;
    }

    if (!eventType) {
        console.warn('❌ Mensaje sin tipo de evento:', data);
        return;
    }

    console.log(`📨 Evento detectado: "${eventType}"`, payload);

    // Ejecutar callbacks
    if (this.eventHandlers[eventType]) {
        this.eventHandlers[eventType].forEach(callback => {
            callback(payload);
        });
    } else {
        console.warn(`⚠️ No hay handlers para el evento: ${eventType}`);
    }
}


sendLobbyChat(content) {
    console.log('🔴 DEBUG sendLobbyChat llamado');
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



    console.log('📤 Enviando mensaje:', message);
    console.log('📤 Stringified:', JSON.stringify(message));
    
    try {
        this.socket.send(JSON.stringify(message));
        console.log('✅ Mensaje enviado exitosamente');
    } catch (error) {
        console.error('❌ Error al enviar mensaje:', error);
    }
}





    /**
     * Envía un mensaje al chat privado de la partida
     * @param {string} matchId - ID de la partida actual
     * @param {string} content - Contenido del mensaje
     */
    sendMatchChat(matchId, content) {
        if (!this.isConnected) {
            console.error('No hay conexión WebSocket');
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
     * Cierra la conexión WebSocket
     */
    disconnect() {
        if (this.socket && this.isConnected) {
            this.socket.close();
            this.isConnected = false;
            console.log('🔌 Desconectado del servidor');
        }
    }
}
