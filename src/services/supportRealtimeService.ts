import * as SecureStore from 'expo-secure-store';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { API, APP_CONFIG, SUPPORT_CHAT_REALTIME } from '../constants';
import {
  SupportConversationRealtimeUpdate,
  SupportRealtimeIncomingMessage,
  SupportMessage,
  SupportRealtimeConnectionState,
  SupportTypingPayload,
} from '../types';

type MessageHandler = (message: SupportMessage) => void;
type ConversationHandler = (
  update: SupportConversationRealtimeUpdate
) => void;
type ConnectionStateHandler = (
  state: SupportRealtimeConnectionState
) => void;
type TypingHandler = (payload: SupportTypingPayload) => void;

class SupportRealtimeService {
  private connection: HubConnection | null = null;
  private currentConversationId: number | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private conversationHandlers = new Set<ConversationHandler>();
  private connectionStateHandlers = new Set<ConnectionStateHandler>();
  private typingHandlers = new Set<TypingHandler>();
  private stoppedTypingHandlers = new Set<TypingHandler>();
  private registeredEventNames = new Set<string>();

  async connect(): Promise<void> {
    if (
      this.connection &&
      (this.connection.state === HubConnectionState.Connected ||
        this.connection.state === HubConnectionState.Connecting ||
        this.connection.state === HubConnectionState.Reconnecting)
    ) {
      return;
    }

    this.emitConnectionState('connecting');

    if (!this.connection) {
      this.connection = this.createConnection();
      this.registerCoreHandlers(this.connection);
      this.registerRealtimeHandlers(this.connection);
    }

    if (this.connection.state === HubConnectionState.Disconnected) {
      await this.connection.start();
    }

    this.emitConnectionState('connected');
  }

  async disconnect(): Promise<void> {
    this.currentConversationId = null;

    if (!this.connection) {
      this.emitConnectionState('disconnected');
      return;
    }

    if (this.connection.state !== HubConnectionState.Disconnected) {
      await this.connection.stop();
    }

    this.connection = null;
    this.registeredEventNames.clear();
    this.emitConnectionState('disconnected');
  }

  async joinConversation(conversationId: number): Promise<void> {
    this.currentConversationId = conversationId;
    await this.connect();

    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }

    await this.tryInvoke(
      SUPPORT_CHAT_REALTIME.METHODS.JOIN_CONVERSATION,
      conversationId
    );
  }

  async sendMessage(
    conversationId: number,
    content: string
  ): Promise<void> {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return;
    }

    await this.connect();

    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('Support realtime connection is not connected');
    }

    let lastError: unknown;

    for (const methodName of SUPPORT_CHAT_REALTIME.METHODS.SEND_MESSAGE) {
      try {
        await this.connection.invoke(methodName, conversationId, trimmedContent);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Failed to send support chat message');
  }

  async sendUserTyping(conversationId: number): Promise<void> {
    await this.connect();

    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }

    await this.tryInvoke(SUPPORT_CHAT_REALTIME.METHODS.USER_TYPING, conversationId);
  }

  async sendUserStoppedTyping(conversationId: number): Promise<void> {
    await this.connect();

    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      return;
    }

    await this.tryInvoke(
      SUPPORT_CHAT_REALTIME.METHODS.USER_STOPPED_TYPING,
      conversationId
    );
  }

  async leaveConversation(conversationId: number): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      if (this.currentConversationId === conversationId) {
        this.currentConversationId = null;
      }
      return;
    }

    try {
      await this.tryInvoke(
        SUPPORT_CHAT_REALTIME.METHODS.LEAVE_CONVERSATION,
        conversationId
      );
    } finally {
      if (this.currentConversationId === conversationId) {
        this.currentConversationId = null;
      }
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onConversationUpdated(handler: ConversationHandler): () => void {
    this.conversationHandlers.add(handler);
    return () => {
      this.conversationHandlers.delete(handler);
    };
  }

  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.add(handler);
    handler(this.getConnectionState());
    return () => {
      this.connectionStateHandlers.delete(handler);
    };
  }

  onUserTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => {
      this.typingHandlers.delete(handler);
    };
  }

  onUserStoppedTyping(handler: TypingHandler): () => void {
    this.stoppedTypingHandlers.add(handler);
    return () => {
      this.stoppedTypingHandlers.delete(handler);
    };
  }

  private createConnection(): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(this.getHubUrl(), {
        accessTokenFactory: async () =>
          (await SecureStore.getItemAsync(
            APP_CONFIG.SECURE_STORE_KEYS.ACCESS_TOKEN
          )) ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(__DEV__ ? LogLevel.Information : LogLevel.Warning)
      .build();
  }

  private getHubUrl(): string {
    const baseUrl = API.BASE_URL.replace(/\/api\/?$/, '');
    return `${baseUrl}${API.ENDPOINTS.SUPPORT_CHAT_HUB}`;
  }

  private registerCoreHandlers(connection: HubConnection) {
    connection.onreconnecting(() => {
      this.emitConnectionState('reconnecting');
    });

    connection.onreconnected(async () => {
      this.emitConnectionState('connected');
      if (this.currentConversationId !== null) {
        try {
          await this.tryInvoke(
            SUPPORT_CHAT_REALTIME.METHODS.JOIN_CONVERSATION,
            this.currentConversationId
          );
        } catch (error) {
          console.error('Failed to rejoin support conversation:', error);
        }
      }
    });

    connection.onclose(() => {
      this.emitConnectionState('disconnected');
    });
  }

  private registerRealtimeHandlers(connection: HubConnection) {
    this.registerEventNames(
      connection,
      SUPPORT_CHAT_REALTIME.EVENTS.MESSAGE_RECEIVED,
      (message: SupportMessage | SupportRealtimeIncomingMessage) => {
        if (!message) return;
        const normalizedMessage = this.normalizeIncomingMessage(message);
        this.messageHandlers.forEach((handler) => handler(normalizedMessage));
      }
    );

    this.registerEventNames(
      connection,
      SUPPORT_CHAT_REALTIME.EVENTS.CONVERSATION_UPDATED,
      (update: SupportConversationRealtimeUpdate) => {
        if (!update) return;
        this.conversationHandlers.forEach((handler) => handler(update));
      }
    );

    this.registerEventNames(
      connection,
      SUPPORT_CHAT_REALTIME.EVENTS.CONVERSATION_CLOSED,
      (payload: SupportConversationRealtimeUpdate | number) => {
        const update =
          typeof payload === 'number'
            ? { conversationId: payload }
            : payload;
        if (!update) return;

        this.conversationHandlers.forEach((handler) =>
          handler({
            ...update,
            endedAt: update.endedAt ?? new Date().toISOString(),
          })
        );
      }
    );

    this.registerEventNames(
      connection,
      SUPPORT_CHAT_REALTIME.EVENTS.USER_TYPING,
      (payload: SupportTypingPayload) => {
        if (!payload) return;
        this.typingHandlers.forEach((handler) => handler(payload));
      }
    );

    this.registerEventNames(
      connection,
      SUPPORT_CHAT_REALTIME.EVENTS.USER_STOPPED_TYPING,
      (payload: SupportTypingPayload) => {
        if (!payload) return;
        this.stoppedTypingHandlers.forEach((handler) => handler(payload));
      }
    );
  }

  private registerEventNames<T>(
    connection: HubConnection,
    eventNames: readonly string[],
    handler: (payload: T) => void
  ) {
    eventNames.forEach((eventName) => {
      if (this.registeredEventNames.has(eventName)) {
        return;
      }

      connection.on(eventName, handler);
      this.registeredEventNames.add(eventName);
    });
  }

  private async tryInvoke(
    methodNames: readonly string[],
    conversationId: number
  ): Promise<void> {
    if (!this.connection) {
      throw new Error('Support realtime connection is not initialized');
    }

    let lastError: unknown;

    for (const methodName of methodNames) {
      try {
        await this.connection.invoke(methodName, conversationId);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Failed to invoke support realtime hub method');
  }

  private normalizeIncomingMessage(
    message: SupportMessage | SupportRealtimeIncomingMessage
  ): SupportMessage {
    if ('chatSessionId' in message) {
      return message;
    }

    return {
      id: message.messageId,
      chatSessionId: message.conversationId,
      senderId: message.senderId,
      senderName: null,
      content: message.content,
      createdAt: message.sendAt,
    };
  }

  private getConnectionState(): SupportRealtimeConnectionState {
    if (!this.connection) {
      return 'disconnected';
    }

    switch (this.connection.state) {
      case HubConnectionState.Connected:
        return 'connected';
      case HubConnectionState.Connecting:
        return 'connecting';
      case HubConnectionState.Reconnecting:
        return 'reconnecting';
      default:
        return 'disconnected';
    }
  }

  private emitConnectionState(state: SupportRealtimeConnectionState) {
    this.connectionStateHandlers.forEach((handler) => handler(state));
  }
}

export const supportRealtimeService = new SupportRealtimeService();
