const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    client: {
      webSocketURL: {
        protocol: process.env.VUE_APP_DEV_WS_PROTOCOL || "wss",
        hostname:
          process.env.VUE_APP_DEV_WS_HOSTNAME || "collaboration.c2stem.org",
        port: process.env.VUE_APP_DEV_WS_PORT || 443,
        pathname: "/ws",
      },
    },
    allowedHosts: ["localhost", "c2-stem.org", ".c2stem.org", "127.0.0.1"],
  },
});
