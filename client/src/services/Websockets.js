export default {
  connect() {
    const ws_url = "ws://localhost:8080";
    const socket = new WebSocket(ws_url);
    socket.onopen = () => {
      console.log("Connected to the WebSocket server");
    };
    socket.onclose = () => {
      console.log("Disconnected from the WebSocket server");
    };
    return socket;
  },
};
