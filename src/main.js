import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import mitt from "mitt";
import Token from "./services/Token";
import { installInquiry } from "./inquiry";

const emitter = mitt();
const app = createApp(App);
app.config.globalProperties.emitter = emitter;
app.use(store).use(router);
installInquiry({
  store,
  baseURL:
    process.env.VUE_APP_INQUIRY_API_URL || "https://inquiry.c2-stem.org/api/v1",
  getToken: () => Token.getAccessToken(),
  // Dev-only stand-in for the service; the build leaves it out when the flag is off
  api:
    process.env.NODE_ENV === "development" &&
    process.env.VUE_APP_INQUIRY_MOCK === "true"
      ? require("./inquiry/mock").createMockInquiryApi()
      : undefined,
});
app.mount("#app");

import "bootstrap/dist/js/bootstrap.js";
