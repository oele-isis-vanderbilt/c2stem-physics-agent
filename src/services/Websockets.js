export default {
  socket: null,
  username: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000, // Start with 1 second
  maxReconnectDelay: 30000, // Max 30 seconds
  messageQueue: [],
  pendingMessages: new Map(), // Track messages waiting for acknowledgment
  messageIdCounter: 0,
  onMessageCallback: null,
  onCloseCallback: null,
  onReconnectCallback: null,
  reconnectTimer: null,
  connectionState: "disconnected", // disconnected, connecting, connected, reconnecting

  connect(username, onMessage, onClose, onReconnect) {
    this.username = username;
    this.onMessageCallback = onMessage;
    this.onCloseCallback = onClose;
    this.onReconnectCallback = onReconnect;

    // const ws_url = `ws://localhost:8000/app/ws/data?username=${encodeURIComponent(
    //   username
    // )}`;
    const ws_url = `wss://agent.c2-stem.org/app/ws/data?username=${encodeURIComponent(
      username
    )}`;

    this.connectionState = "connecting";
    this.socket = new WebSocket(ws_url);

    this.socket.onopen = () => {
      console.log("Connected to the WebSocket server for", username);
      this.connectionState = "connected";
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Send any queued messages
      this.flushMessageQueue();

      if (this.reconnectAttempts > 0 && this.onReconnectCallback) {
        this.onReconnectCallback();
      }
    };

    this.socket.onmessage = (event) => {
      // Check if this is an acknowledgment message
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ack" && data.messageId) {
          // Remove from pending messages
          const pendingMsg = this.pendingMessages.get(data.messageId);
          if (pendingMsg) {
            clearTimeout(pendingMsg.timeout);
            this.pendingMessages.delete(data.messageId);
            if (pendingMsg.resolve) {
              pendingMsg.resolve(data);
            }
          }
          return;
        }
      } catch (e) {
        // Not a JSON message or not an ack, continue with normal handling
      }

      if (this.onMessageCallback) {
        this.onMessageCallback(event);
      }
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.connectionState = "disconnected";
    };

    this.socket.onclose = (event) => {
      console.log(
        "Disconnected from the WebSocket server",
        event.code,
        event.reason
      );
      this.connectionState = "disconnected";

      if (this.onCloseCallback) {
        this.onCloseCallback(event);
      }

      // Attempt to reconnect
      this.attemptReconnect();
    };

    return this.socket;
  },

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(
        "Max reconnection attempts reached. Please refresh the page."
      );
      return;
    }

    if (this.connectionState === "reconnecting") {
      return; // Already attempting to reconnect
    }

    this.connectionState = "reconnecting";
    this.reconnectAttempts++;

    // Calculate exponential backoff delay
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(
      `Reconnecting in ${delay / 1000} seconds... (attempt ${
        this.reconnectAttempts
      }/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      if (this.username) {
        console.log("Attempting to reconnect...");
        this.connect(
          this.username,
          this.onMessageCallback,
          this.onCloseCallback,
          this.onReconnectCallback
        );
      }
    }, delay);
  },

  sendWithAck(data, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.connectionState !== "connected") {
        // Queue the message for later
        this.messageQueue.push({ data, resolve, reject, timeout });
        console.log("Message queued - connection not ready");
        return;
      }

      const messageId = ++this.messageIdCounter;
      const messageWithId = {
        ...data,
        messageId,
      };

      // Set up timeout for acknowledgment
      const timeoutHandle = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(
          new Error(`Message acknowledgment timeout for message ${messageId}`)
        );
      }, timeout);

      // Store the message in pending map
      this.pendingMessages.set(messageId, {
        data: messageWithId,
        resolve,
        reject,
        timeout: timeoutHandle,
        timestamp: Date.now(),
      });

      try {
        this.socket.send(JSON.stringify(messageWithId));
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingMessages.delete(messageId);
        reject(error);
      }
    });
  },

  send(data) {
    if (this.connectionState !== "connected") {
      // Queue the message for later
      this.messageQueue.push({ data });
      console.log("Message queued - connection not ready");
      return;
    }

    try {
      this.socket.send(JSON.stringify(data));
    } catch (error) {
      console.error("Error sending message:", error);
      this.messageQueue.push({ data });
    }
  },

  flushMessageQueue() {
    while (
      this.messageQueue.length > 0 &&
      this.connectionState === "connected"
    ) {
      const { data, resolve, reject, timeout } = this.messageQueue.shift();

      if (resolve) {
        // This was a sendWithAck message
        this.sendWithAck(data, timeout).then(resolve).catch(reject);
      } else {
        // Regular send
        this.send(data);
      }
    }
  },

  getConnectionState() {
    return this.connectionState;
  },

  isConnected() {
    return (
      this.connectionState === "connected" &&
      this.socket?.readyState === WebSocket.OPEN
    );
  },

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear all pending message timeouts
    this.pendingMessages.forEach((msg) => {
      if (msg.timeout) {
        clearTimeout(msg.timeout);
      }
    });
    this.pendingMessages.clear();

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connectionState = "disconnected";
  },
};
