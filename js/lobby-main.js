/**
 * Controlador principal del Lobby (Etapa I - Club de Oficiales)
 * Gestiona el login, chat global, lista de usuarios y envío de retos
 */

import { WebSocketManager } from './network/websocket-manager.js';
import { API_CONFIG } from '../utils/constants.js';

// Variables globales del estado del lobby
let wsManager = null;
let currentUserId = null;
let currentUsername = null;
let selectedOpponentId = null;
let selectedOpponentName = null;
let pendingChallengeId = null;

// ========================================
// INICIALIZACIÓN
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

    // Permitir enviar con Enter
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });

    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();

        // Validación del nombre de usuario
        if (username.length < 3 || username.length > 30) {
            errorMessage.textContent = 'El nombre debe tener entre 3 y 30 caracteres';
            return;
        }

        // Validar caracteres permitidos (letras, números, espacios, guiones bajos)
        const validPattern = /^[a-zA-Z0-9\s_]+$/;
        if (!validPattern.test(username)) {
            errorMessage.textContent = 'Solo se permiten letras, números, espacios y guiones bajos';
            return;
        }

        // Intentar registrar al usuario
        errorMessage.textContent = '';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Conectando...';

        try {
            await registerUser(username);
        } catch (error) {
            errorMessage.textContent = error.message;
            loginBtn.disabled = false;
            loginBtn.textContent = 'Entrar al Cuartel';
        }
    });
}

/**
 * Registra al usuario en el servidor vía REST API
 * @param {string} username - Nombre del usuario
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
        throw new Error(errorData.message || 'Error al conectar con el servidor');
    }

    const data = await response.json();
    currentUserId = data.userId;
    currentUsername = data.username;

    console.log('✅ Usuario registrado:', data);

    // Conectar WebSocket y cambiar a pantalla de lobby
    connectWebSocket();
    switchToLobbyScreen();
    loadUsersList();
}

// ========================================
// CONEXIÓN WEBSOCKET
// ========================================

function connectWebSocket() {
    wsManager = new WebSocketManager();
    wsManager.connect(currentUserId, currentUsername);

    // Registrar listeners para eventos del servidor
    wsManager.on('lobby_update', handleLobbyUpdate);
    wsManager.on('lobby_chat_message', handleLobbyChatMessage);
    wsManager.on('challenge_received', handleChallengeReceived);
    wsManager.on('challenge_answered', handleChallengeAnswered);
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
    // Botón de logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Chat global
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

    // Botón de reto PvP
    document.getElementById('challenge-btn').addEventListener('click', sendChallenge);

    // Botón de PvE (contra el bot)
    document.getElementById('pve-btn').addEventListener('click', startPvEMatch);
}

// ========================================
// GESTIÓN DE USUARIOS
// ========================================

/**
 * Carga la lista de usuarios conectados vía REST API
 */
async function loadUsersList() {
    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/users?status=connected`, {
            headers: {
                'Authorization': `Bearer ${currentUserId}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar usuarios');
        }

        const data = await response.json();
        renderUsersList(data.users);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

/**
 * Maneja actualizaciones de la lista de usuarios vía WebSocket
 * @param {Array} users - Lista de usuarios actualizada
 */
function handleLobbyUpdate(payload) {
    console.log('📋 Actualización del lobby:', payload);
    if (payload && Array.isArray(payload)) {
        renderUsersList(payload);
    }
}

/**
 * Renderiza la lista de usuarios en el panel izquierdo
 * @param {Array} users - Lista de usuarios
 */
function renderUsersList(users) {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    users.forEach(user => {
        // No mostrar al propio usuario en la lista
        if (user.userId === currentUserId) {
            return;
        }

        const userItem = document.createElement('div');
        userItem.classList.add('user-item');

        // Marcar al bot con estilo especial
        if (user.userId === '00000000-0000-0000-0000-000000000000') {
            userItem.classList.add('bot');
        }

        // Deshabilitar usuarios que están en partida
        if (user.status === 'IN_MATCH') {
            userItem.classList.add('in-match');
        }

        userItem.innerHTML = `
            <span class="user-name">${user.username}</span>
            <span class="user-status">${user.status === 'AVAILABLE' ? 'Disponible' : 'En partida'}</span>
        `;

        // Permitir seleccionar solo usuarios disponibles
        if (user.status === 'AVAILABLE') {
            userItem.addEventListener('click', () => {
                selectOpponent(user.userId, user.username, userItem);
            });
        }

        usersList.appendChild(userItem);
    });
}

/**
 * Selecciona un oponente para retar
 * @param {string} userId - ID del usuario seleccionado
 * @param {string} username - Nombre del usuario
 * @param {HTMLElement} element - Elemento DOM del usuario
 */
function selectOpponent(userId, username, element) {
    // Remover selección previa
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Marcar nuevo seleccionado
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

    // Enviar al servidor
    wsManager.sendLobbyChat(message);
    chatInput.value = '';
}


/**
 * Maneja mensajes de chat recibidos vía WebSocket
 * @param {Object} payload - Datos del mensaje
 */
function handleLobbyChatMessage(payload) {
    console.log('💬 Mensaje de chat recibido:', payload);

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

/**
 * Envía un reto a otro jugador
 */
async function sendChallenge() {
    if (!selectedOpponentId) {
        alert('Selecciona un oponente primero');
        return;
    }

    const gameMode = document.getElementById('game-mode-select').value;

    // Seleccionar protocolo de forma aleatoria (50% cada uno)
    const protocolMode = Math.random() < 0.5 ? 'FETCH_FIRST' : 'SOCKET_FIRST';

    const challengeData = {
        targetUserId: selectedOpponentId,
        mode: gameMode,
        protocolMode: protocolMode
    };

    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/challenges`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUserId}`
            },
            body: JSON.stringify(challengeData)
        });

        if (!response.ok) {
            throw new Error('Error al enviar reto');
        }

        const data = await response.json();
        console.log('✅ Reto enviado:', data);
        alert(`Reto enviado a ${selectedOpponentName}. Esperando respuesta...`);

    } catch (error) {
        console.error('Error enviando reto:', error);
        alert('Error al enviar el reto');
    }
}

/**
 * Maneja la recepción de un reto vía WebSocket
 * @param {Object} payload - Datos del reto
 */
function handleChallengeReceived(payload) {
    console.log('⚔️ Reto recibido:', payload);

    pendingChallengeId = payload.challengeId;

    const modal = document.getElementById('challenge-modal');
    const message = document.getElementById('challenge-message');

    const modeText = payload.mode === 'CLASSIC_WAR' ? 'Guerra Clásica (40 piezas)' : 'Duelo Rápido (10 piezas)';
    const protocolText = payload.protocolMode === 'FETCH_FIRST' ? 'Fetch + SSE' : 'WebSockets';

    message.innerHTML = `
        <strong>${payload.challenger.username}</strong> te ha retado a:<br>
        <strong>Modo:</strong> ${modeText}<br>
        <strong>Protocolo:</strong> ${protocolText}
    `;

    modal.style.display = 'flex';

    // Botones de aceptar/rechazar
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
 * Responde a un reto recibido
 * @param {string} answer - 'ACCEPTED' o 'REJECTED'
 */
async function answerChallenge(answer) {
    try {
        const response = await fetch(`${API_CONFIG.API_URL}/api/challenges/${pendingChallengeId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUserId}`
            },
            body: JSON.stringify({
                challengeId: pendingChallengeId,
                answer: answer
            })
        });

        if (!response.ok) {
            throw new Error('Error al responder reto');
        }

        console.log(`✅ Reto ${answer}`);

    } catch (error) {
        console.error('Error respondiendo reto:', error);
        alert('Error al responder el reto');
    }
}

/**
 * Maneja la respuesta a un reto vía WebSocket
 * @param {Object} payload - Datos de la respuesta
 */
function handleChallengeAnswered(payload) {
    console.log('📨 Respuesta al reto:', payload);

    if (payload.answer === 'REJECTED') {
        alert(`${payload.challenged.username} ha rechazado tu reto`);
        return;
    }

    if (payload.answer === 'ACCEPTED') {
        alert('¡Reto aceptado! Redirigiendo al juego...');
        
        // Guardar datos de la partida en localStorage
        localStorage.setItem('matchId', payload.matchId);
        localStorage.setItem('myTeam', payload.challenger.userId === currentUserId ? 'RED' : 'BLUE');
        localStorage.setItem('userId', currentUserId);
        
        // Redirigir a la pantalla de setup (próximo paso del proyecto)
        // window.location.href = 'setup.html';
        console.log('🎮 Redirección a setup (aún no implementado)');
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

        // Desconectar WebSocket
        if (wsManager) {
            wsManager.disconnect();
        }

        // Recargar la página para volver al login
        window.location.reload();

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        window.location.reload();
    }
}
