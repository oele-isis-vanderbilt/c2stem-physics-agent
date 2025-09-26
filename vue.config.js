const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    client: {
      webSocketURL: {
        protocol: "wss", // Use secure WebSocket protocol
        hostname: "collaboration.c2stem.org", // Use your actual domain name
        port: 443, // If your certificate is for port 443, use it. Otherwise, adjust to your public port.
        pathname: "/ws", // This should match what your server (or reverse proxy) expects
      },
      // webSocketURL: {
      //   protocol: "ws", // Regular WebSocket for local development
      //   hostname: "localhost",
      //   port: 8002, // Your local dev server port
      //   pathname: "/ws",
      // },
    },
    allowedHosts: ["localhost", "c2-stem.org", ".c2stem.org", "127.0.0.1"],
  },
});
