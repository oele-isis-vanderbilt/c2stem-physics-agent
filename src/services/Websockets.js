export default {
  connect() {
    // const ws_url = `wss://localhost:8000/ws/data?username=${encodeURIComponent(this.username)}`;
    const ws_url = `wss://agent.c2-stem.org/app/ws/data`;
    const socket = new WebSocket(ws_url);
    socket.onopen = () => {
      console.log("Connected to the WebSocket server");
      // Last socket activity can be added here. Recording the last time a socket was connected
    };
    socket.onclose = () => {
      console.log("Disconnected from the WebSocket server");
    };
    return socket;
  },
};
