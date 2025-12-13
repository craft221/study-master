/**
 * Service WebSocket pour la communication en temps réel
 */

type MessageHandler = (data: any) => void;
type ConnectionHandler = () => void;

interface WebSocketMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

interface WebSocketConfig {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isConnected = false;

  // Event handlers
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private onConnectHandlers: Set<ConnectionHandler> = new Set();
  private onDisconnectHandlers: Set<ConnectionHandler> = new Set();
  private onErrorHandlers: Set<(error: Event) => void> = new Set();

  // Pending messages queue (for offline support)
  private pendingMessages: WebSocketMessage[] = [];

  /**
   * Initialiser et connecter le WebSocket
   */
  connect(config: WebSocketConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Connexion déjà en cours'));
        return;
      }

      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.config = {
        ...config,
        reconnectInterval: config.reconnectInterval || 3000,
        maxReconnectAttempts: config.maxReconnectAttempts || 10,
        heartbeatInterval: config.heartbeatInterval || 30000,
      };

      this.isConnecting = true;
      this.createConnection(resolve, reject);
    });
  }

  /**
   * Créer la connexion WebSocket
   */
  private createConnection(
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ): void {
    if (!this.config) return;

    try {
      const wsUrl = `${this.config.url}?token=${this.config.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connecté');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Démarrer le heartbeat
        this.startHeartbeat();

        // Envoyer les messages en attente
        this.flushPendingMessages();

        // Notifier les handlers
        this.onConnectHandlers.forEach(handler => handler());

        if (onSuccess) onSuccess();
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Déconnecté', event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();

        // Notifier les handlers
        this.onDisconnectHandlers.forEach(handler => handler());

        // Tenter de reconnecter
        if (!event.wasClean && this.config) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Erreur:', error);
        this.isConnecting = false;

        // Notifier les handlers
        this.onErrorHandlers.forEach(handler => handler(error));

        if (onError) onError(new Error('Erreur de connexion WebSocket'));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Erreur de parsing:', error);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Erreur de création:', error);
      this.isConnecting = false;
      if (onError) onError(error as Error);
    }
  }

  /**
   * Gérer les messages reçus
   */
  private handleMessage(message: WebSocketMessage): void {
    const { type } = message;

    // Gestion du pong
    if (type === 'pong') return;

    // Notifier les handlers pour ce type de message
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Notifier les handlers génériques (*)
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * Programmer une reconnexion
   */
  private scheduleReconnect(): void {
    if (!this.config) return;

    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error('[WebSocket] Nombre maximum de tentatives de reconnexion atteint');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      (this.config.reconnectInterval || 3000) * Math.pow(1.5, this.reconnectAttempts - 1),
      30000
    );

    console.log(`[WebSocket] Reconnexion dans ${delay / 1000}s (tentative ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }

  /**
   * Démarrer le heartbeat
   */
  private startHeartbeat(): void {
    if (!this.config?.heartbeatInterval) return;

    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, this.config.heartbeatInterval);
  }

  /**
   * Arrêter le heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Envoyer un message
   */
  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }

    // Ajouter à la queue si déconnecté
    this.pendingMessages.push(message);
    return false;
  }

  /**
   * Envoyer les messages en attente
   */
  private flushPendingMessages(): void {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * S'abonner à un type de message
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Retourner une fonction de désabonnement
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * S'abonner à tous les messages
   */
  onAny(handler: MessageHandler): () => void {
    return this.on('*', handler);
  }

  /**
   * S'abonner à la connexion
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.onConnectHandlers.add(handler);
    return () => this.onConnectHandlers.delete(handler);
  }

  /**
   * S'abonner à la déconnexion
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.onDisconnectHandlers.add(handler);
    return () => this.onDisconnectHandlers.delete(handler);
  }

  /**
   * S'abonner aux erreurs
   */
  onError(handler: (error: Event) => void): () => void {
    this.onErrorHandlers.add(handler);
    return () => this.onErrorHandlers.delete(handler);
  }

  /**
   * Rejoindre une room
   */
  joinRoom(roomId: string): void {
    this.send({
      type: 'join_room',
      data: { room_id: roomId }
    });
  }

  /**
   * Quitter une room
   */
  leaveRoom(roomId: string): void {
    this.send({
      type: 'leave_room',
      data: { room_id: roomId }
    });
  }

  /**
   * Envoyer un message de groupe
   */
  sendGroupMessage(groupId: number, content: string, messageType: string = 'text'): void {
    this.send({
      type: 'group_message',
      data: {
        group_id: groupId,
        content,
        type: messageType
      }
    });
  }

  /**
   * Mettre à jour la présence
   */
  updatePresence(roomId: string, status: string, metadata?: Record<string, any>): void {
    this.send({
      type: 'presence',
      data: {
        action: 'update_status',
        room_id: roomId,
        status,
        metadata
      }
    });
  }

  /**
   * Indiquer qu'on est en train de taper
   */
  sendTyping(roomId: string, isTyping: boolean = true): void {
    this.send({
      type: 'presence',
      data: {
        action: 'typing',
        room_id: roomId,
        is_typing: isTyping
      }
    });
  }

  /**
   * Obtenir l'état de connexion
   */
  getState(): { isConnected: boolean; isConnecting: boolean } {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting
    };
  }

  /**
   * Déconnecter
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Déconnexion volontaire');
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.config = null;
  }
}

// Instance singleton
export const wsService = new WebSocketService();

export default wsService;
