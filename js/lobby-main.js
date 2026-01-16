/**
 * controlador principal del Lobby (Etapa I - Club de Oficiales)
 * gestiona el login, chat global, lista de usuarios y envio de retos
 */

import { WebSocketManager } from './network/websocket-manager.js';
import { API_CONFIG } from '../utils/constants.js';

// variables globales del estado del lobby
let wsManager = null;
let currentUserId = null;
let currentUsername = null;
let selectedOpponentId = null;
let selectedOpponentName = null;
let pendingChallengeId = null;

// ========================================
// INICIALIZACION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeLoginScreen();
});

// ========================================
// PANTALLA DE LOGIN
// ========================================

function initializeLoginScreen() {
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username-input');
    const errorMessage = document.getElementById('login-error');

    // permitir enviar con Enter
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });

    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();

        // validacion del nombre de usuario
        if (username.length < 3 || username.length > 30) {
            errorMessage.textContent = 'el nombre debe tener entre 3 y 30 caracteres';
            return;
        }

        // validar caracteres permitidos (letras, numeros, espacios, guiones bajos)
        const validPattern = /^[a-zA-Z0-9\s_]+$/;
        if (!validPattern.test(username)) {
            errorMessage.textContent = 'solo se permiten letras, numeros, espacios y guiones bajos';
            return;
        }

        // intentar registrar al usuario
        errorMessage.textContent = '';
        loginBtn.disabled = true;
        loginBtn.textContent = 'conectando...';

        try {
            await registerUser(username);
        } catch (error) {
            errorMessage.textContent = error.message;
            loginBtn.disabled = false;
            loginBtn.textContent = 'entrar al Cuartel';
        }
    });
}

/**
 * registra al usuario en el servidor via REST API
 * @param {string} username - nombre del usuario
 */
async function registerUser(username) {
    const response = await fetch(`${API_CONFIG.API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'error al conectar con el servidor');
    }

    const data = await response.json();
    currentUserId = data.userId;
    currentUsername = data.username;

    console.log(' usuario registrado:', data);

    // conectar WebSocket y cambiar a pantalla de lobby
    connectWebSocket();
    switchToLobbyScreen();
    loadUsersList();
}

// ========================================
// WEBSOCKET Y SSE
// ========================================

function connectWebSocket() {
    wsManager = new WebSocketManager();
    wsManager.connect(currentUserId, currentUsername); 
    
    // WebSocket: solo para chat
    wsManager.on('lobby_chat_message', handleLobbyChatMessage);
    wsManager.on('challenge_answered', handleChallengeAnswered);
    wsManager.on('match_started', handleMatchStarted);
    
    // conectar SSE para eventos del lobby
    connectSSE();
}

// conexion SSE
function connectSSE() {
    const eventSource = new EventSource(`${API_CONFIG.API_URL}/api/events/stream?userId=${currentUserId}`);
    
    eventSource.addEventListener('lobby_update', (e) => {
        const data = JSON.parse(e.data);
        handleLobbyUpdate(data);
    });
    
    eventSource.addEventListener('challenge_received', (e) => {
        const data = JSON.parse(e.data);
        handleChallengeReceived(data);
    });
    
    eventSource.addEventListener('challenge_answered', (e) => {
        const data = JSON.parse(e.data);
        handleChallengeAnswered(data);
    });
    
    eventSource.addEventListener('match_started', (e) => {
        const data = JSON.parse(e.data);
        handleMatchStarted(data);
    });

    eventSource.onerror = (error) => {
        console.error('error en SSE:', error);
    };
}

function handleMatchStarted(payload) {
    console.log(' partida iniciada:', payload);
    alert('¡ambos listos! Iniciando batalla...');
    
    localStorage.setItem('yourTurn', payload.yourTurn);
    window.location.href = 'game.html';
}




// ========================================
// CAMBIO DE PANTALLAS
// ========================================

function switchToLobbyScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('lobby-screen').style.display = 'flex';
    document.getElementById('current-username').textContent = currentUsername;

    initializeLobbyControls();
}

// ========================================
// CONTROLES DEL LOBBY
// ========================================

function initializeLobbyControls() {
    // boton de logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // chat global
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    sendChatBtn.addEventListener('click', () => {
        sendChatMessage();
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // boton de reto PvP
    document.getElementById('challenge-btn').addEventListener('click', sendChallenge);

    // boton de PvE (contra el bot)
    document.getElementById('pve-btn').addEventListener('click', startPvEMatch);
}

// ========================================
// GESTION DE USUARIOS
// ========================================

/**
 * carga la lista de usuarios conectados via REST API
 */
async function loadUsersList() {
    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/users?status=connected`, {
            headers: {
                'Authorization': `Bearer ${currentUserId}`
            }
        });

        if (!response.ok) {
            throw new Error('error al cargar usuarios');
        }

        const data = await response.json();
        renderUsersList(data.users);
    } catch (error) {
        console.error('error cargando usuarios:', error);
    }
}

/**
 * maneja actualizaciones de la lista de usuarios via WebSocket
 * @param {Array} users - lista de usuarios actualizada
 */
function handleLobbyUpdate(payload) {
    console.log(' actualizacion del lobby:', payload);
    if (payload && Array.isArray(payload)) {
        renderUsersList(payload);
    }
}

/**
 * renderiza la lista de usuarios en el panel izquierdo
 * @param {Array} users - lista de usuarios
 */
function renderUsersList(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        // no mostrar al propio usuario en la lista
        if (user.userId === currentUserId) {
            return;
        }

        const userItem = document.createElement('div');
        userItem.classList.add('user-item');

        // marcar al bot con estilo especial
        if (user.userId === '00000000-0000-0000-0000-000000000000') {
            userItem.classList.add('bot');
        }

        // deshabilitar usuarios que estan en partida
        if (user.status === 'IN_MATCH') {
            userItem.classList.add('in-match');
        }

        userItem.innerHTML = `
            <span class="user-name">${user.username}</span>
            <span class="user-status">${user.status === 'AVAILABLE' ? 'Disponible' : 'En partida'}</span>
        `;

        // permitir seleccionar solo usuarios disponibles
        if (user.status === 'AVAILABLE') {
            userItem.addEventListener('click', () => {
                selectOpponent(user.userId, user.username, userItem);
            });
        }

        usersList.appendChild(userItem);
    });
}

/**
 * selecciona un oponente para retar
 * @param {string} userId - ID del usuario seleccionado
 * @param {string} username - nombre del usuario
 * @param {HTMLElement} element - elemento DOM del usuario
 */
function selectOpponent(userId, username, element) {
    // remover selección previa
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('selected');
    });

    // marcar nuevo seleccionado
    element.classList.add('selected');
    selectedOpponentId = userId;
    selectedOpponentName = username;

    document.getElementById('selected-opponent').textContent = username;
    document.getElementById('challenge-btn').disabled = false;
}

// ========================================
// CHAT GLOBAL
// ========================================

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (message.length === 0) return;

    // enviar al servidor
    wsManager.sendLobbyChat(message);
    chatInput.value = '';
}


/**
 * maneja mensajes de chat recibidos via WebSocket
 * @param {Object} payload - datos del mensaje
 */
function handleLobbyChatMessage(payload) {
    console.log(' mensaje de chat recibido:', payload);

    const chatMessages = document.getElementById('chat-messages');

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message');

    const timestamp = new Date(payload.timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });

    messageElement.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-username">${payload.from.username}</span>
            <span class="chat-timestamp">${timestamp}</span>
        </div>
        <div class="chat-content">${payload.content}</div>
    `;

    chatMessages.appendChild(messageElement);

    // Auto-scroll al último mensaje
    chatMessages.scrollTop = chatMessages.scrollHeight;
}



// ========================================
// SISTEMA DE RETOS (PvP)
// ========================================

async function sendChallenge() {
    if (!selectedOpponentId) {
        alert('selecciona un oponente primero');
        return;
    }

    const gameMode = document.getElementById('game-mode-select').value;
    const protocolMode = Math.random() < 0.5 ? 'FETCH_FIRST' : 'SOCKET_FIRST';

    const challengeData = {
        targetUserId: selectedOpponentId,
        mode: gameMode,
        protocolMode: protocolMode
    };

    // deb
    console.log(' ENVIANDO RETO A:', selectedOpponentName);
    console.log('targetUserId:', selectedOpponentId);
    console.log('datos completos:', challengeData);

    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/challenges`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUserId}`
            },
            body: JSON.stringify(challengeData)
        });

        // debug
        console.log(' respuesta del servidor:', response.status);
        const data = await response.json();
        console.log(' data recibida:', data);

        if (!response.ok) {
            throw new Error('error al enviar reto');
        }

        alert(`reto enviado a ${selectedOpponentName}. esperando respuesta...`);

    } catch (error) {
        console.error('error enviando reto:', error);
        alert('error al enviar el reto');
    }
}


/**
 * maneja la recepcion de un reto via WebSocket
 * @param {Object} payload - datos del reto
 */
function handleChallengeReceived(payload) {
    console.log(' ¡RETO RECIBIDO! payload completo:', payload);
    
    // extraer datos correctos
    const data = payload.info || payload; // adaptarse al formato del servidor
    
    console.log(' datos procesados:', data);

    pendingChallengeId = data.challengeId;

    const modal = document.getElementById('challenge-modal');
    const message = document.getElementById('challenge-message');

    const modeText = data.mode === 'CLASSIC_WAR' ? 'guerra Clásica (40 piezas)' : 'duelo Rápido (10 piezas)';
    const protocolText = data.protocolMode === 'FETCH_FIRST' ? 'Fetch + SSE' : 'WebSockets';

    message.innerHTML = `
        <strong>${data.challenger.username}</strong> te ha retado a:<br>
        <strong>Modo:</strong> ${modeText}<br>
        <strong>Protocolo:</strong> ${protocolText}
    `;

    modal.style.display = 'flex';

    document.getElementById('accept-challenge-btn').onclick = () => {
        answerChallenge('ACCEPTED');
        modal.style.display = 'none';
    };

    document.getElementById('reject-challenge-btn').onclick = () => {
        answerChallenge('REJECTED');
        modal.style.display = 'none';
    };
}


/**
 * responde a un reto recibido
 * @param {string} answer - 'ACCEPTED' o 'REJECTED'
 */
async function answerChallenge(answer) {
    console.log(' ENVIANDO RESPUESTA AL RETO');
    console.log('challenge ID:', pendingChallengeId);
    console.log('status:', answer);
    
    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/challenges/${pendingChallengeId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUserId}`
            },
            body: JSON.stringify({
                status: answer  
            })
        });

        console.log(' status HTTP:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('error:', errorData);
            throw new Error('error al responder reto');
        }

        console.log(` reto ${answer}`);

    } catch (error) {
        console.error(' error completo:', error);
    }
}




/**
 * maneja la respuesta a un reto via WebSocket
 * @param {Object} payload - datos de la respuesta
 */
function handleChallengeAnswered(payload) {
    console.log(' CHALLENGE ANSWERED - payload completo:', payload);
    
    // usar todo el payload
    const answer = payload.answer;
    const matchId = payload.matchId;
    const challenged = payload.challenged;
    const challenger = payload.info?.challenger || payload.challenger;
    const protocolMode = payload.info?.protocolMode || payload.protocolMode;

    console.log('answer:', answer);
    console.log('matchId:', matchId);

    if (answer === 'REJECTED') {
        alert(`${challenged.username} ha rechazado tu reto`);
        return;
    }

    if (answer === 'ACCEPTED') {
        alert('RETO ACEPTADOS! redirigiendo al setup...');
        
        localStorage.setItem('matchId', matchId);
        localStorage.setItem('myTeam', challenger.userId === currentUserId ? 'RED' : 'BLUE');
        localStorage.setItem('userId', currentUserId);
        localStorage.setItem('username', currentUsername);
        localStorage.setItem('protocolMode', protocolMode || 'SOCKET_FIRST');
        
        window.location.href = 'setup.html';
    }
}


// ========================================
// MODO PvE (CONTRA EL BOT)
// ========================================

function startPvEMatch() {
    const gameMode = document.getElementById('pve-mode-select').value;
    
    // El bot siempre tiene este userId
    const botId = '00000000-0000-0000-0000-000000000000';
    
    selectedOpponentId = botId;
    selectedOpponentName = 'Mariscal Autómata';
    
    sendChallenge();
}

// ========================================
// INICIO DE PARTIDA
// ========================================


// ========================================
// LOGOUT
// ========================================

async function logout() {
    try {
        await fetch(`${API_CONFIG.API_URL}/api/sessions/current`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentUserId}`
            }
        });

        // desconectar WebSocket
        if (wsManager) {
            wsManager.disconnect();
        }

        // recargar la pagina para volver al login
        window.location.reload();

    } catch (error) {
        console.error('error al cerrar sesion:', error);
        window.location.reload();
    }


}
