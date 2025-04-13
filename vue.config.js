const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    allowedHosts: ["localhost", "c2-stem.org", ".c2stem.org", "127.0.0.1"],
  },
});
