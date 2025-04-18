export default {
  connect(username) {
    // const ws_url = `ws://localhost:8000/app/ws/data?username=${encodeURIComponent(
    //   username
    // )}`;
    const ws_url = `wss://agent.c2-stem.org/app/ws/data?username=${encodeURIComponent(
      username
    )}`;
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
