<template>
  <!-- SSO mode: show only a loading spinner, no form -->
  <div v-if="isSSOMode" class="login-card">
    <div class="sso-loading">
      <span class="spinner-border text-light mb-3" role="status"></span>
      <p>{{ alertMessage || "Signing in..." }}</p>
    </div>
  </div>

  <!-- Standalone mode: normal login form -->
  <div v-else class="login-card">
    <div class="card">
      <div class="card-body">
        <form @submit.prevent="login">
          <div class="mb-3">
            <h2>Sign in to C2STEM</h2>
          </div>
          <div class="mb-3">
            <label for="userNameId" class="form-label">Username</label>
            <input
              v-model="username"
              type="string"
              class="form-control"
              id="userNameId"
            />
          </div>
          <div class="mb-3">
            <label for="passwordId" class="form-label">Password</label>
            <div class="input-group">
              <input
                v-if="showPassword"
                v-model="password"
                type="text"
                class="form-control"
                id="passwordId"
              />
              <input
                v-else
                v-model="password"
                type="password"
                class="form-control"
                id="passwordId"
              />
              <button class="button" type="button" @click="toggleShow">
                <span class="icon is-small is-right">
                  <i
                    class="bi"
                    :class="{
                      'bi-eye-slash-fill': showPassword,
                      'bi-eye-fill': !showPassword,
                    }"
                  ></i>
                </span>
              </button>
            </div>
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="currentlyLoading"
          >
            <span
              v-if="currentlyLoading"
              class="spinner-border spinner-border-sm me-2"
              role="status"
              aria-hidden="true"
            ></span>
            <span v-if="currentlyLoading">Connecting...</span>
            <span v-else>Login</span>
          </button>
        </form>
      </div>
    </div>
  </div>
  <AlertBox :message="alertMessage" v-if="isActive && !isSSOMode"></AlertBox>
</template>

<script>
/**
 * Login View
 * @requires ../services/Auth.js that contains method for login.
 */
import auth from "../services/Auth.js";
import Token from "../services/Token.js";
import AlertBox from "../components/AlertBox.vue";
import Websockets from "@/services/Websockets";
import BlockParser from "@/services/BlockParser_v1";
import SSOService from "@/services/SSOService";
// import LiveKit from "../services/LiveKit.js";
export default {
  components: { AlertBox },
  data() {
    return {
      username: "",
      password: "",
      ServerURL: "https://physics.c2stem.org",
      cardActive: false,
      alertMessage: "",
      showPassword: false,
      isLoading: false,
      isSSOMode: false,
    };
  },
  computed: {
    currentRouteName() {
      return this.$route.name;
    },
    isActive() {
      return this.cardActive;
    },
    currentlyLoading() {
      return this.isLoading;
    },
  },
  methods: {
    /**
     * Sends a http request to the server with user credentials.
     * @requires username,password.
     * On successful login save user credentials to maintain state.
     * On successful login route the user to landing page.
     */
    login() {
      this.isLoading = true;
      auth
        .login({
          username: this.username,
          password: this.password,
        })
        .then(async ({ data }) => {
          auth
            .netsbloxLogin({
              username: this.username,
              password: this.password,
              ServerURL: this.ServerURL,
            })
            .catch((err) => {
              this.isLoading = false;
              this.cardActive = true;
              this.alertMessage = "Username or Password is incorrect";
              console.log(err);
            })
            .then(async (response) => {
              if (response) {
                this.cardActive = true;
                this.alertMessage = "User found. Logging in...";
                data.username = this.username;
                document.cookie = "username=" + data.username;
                this.$store.dispatch("saveCredentials", data);
                Token.setAccessToken(data.token);

                // Setup socket and wait for connection
                try {
                  await this.setupSocket(this.username);
                  this.alertMessage = "Connected! Redirecting...";
                  // try {
                  //   await LiveKit.tryAndPublish(data.username, this.$store);
                  // } catch (err) {
                  //   console.log(err);
                  // }
                  this.$router.push({ name: "home" });
                } catch (err) {
                  this.isLoading = false;
                  this.cardActive = true;
                  this.alertMessage =
                    "WebSocket connection failed. Please try again.";
                  console.error("WebSocket connection error:", err);
                }
              }
            })
            .catch((err) => {
              this.isLoading = false;
              console.log(err);
            });
        })
        .catch((err) => {
          this.isLoading = false;
          this.cardActive = true;
          this.alertMessage = "Username or Password is incorrect";
          console.log(err);
        });
    },

    async ssoLogin(ssoToken) {
      this.isLoading = true;
      this.cardActive = true;
      this.alertMessage = "Signing in via GENIUS...";

      const secret = process.env.VUE_APP_SSO_SECRET;
      if (!secret) {
        this.isLoading = false;
        this.alertMessage =
          "SSO secret not configured (VUE_APP_SSO_SECRET missing).";
        console.error("[SSO] VUE_APP_SSO_SECRET is not set");
        return;
      }

      let payload;
      try {
        payload = await SSOService.validateToken(ssoToken, secret);
      } catch (err) {
        this.isLoading = false;
        this.alertMessage = "SSO login failed: " + err.message;
        console.error("[SSO] Token validation failed:", err);
        return;
      }

      const username = SSOService.netsBloxUsername(payload);
      const password = process.env.VUE_APP_NETSBLOX_SSO_PASSWORD;
      if (!password) {
        this.isLoading = false;
        this.alertMessage =
          "SSO login failed: VUE_APP_NETSBLOX_SSO_PASSWORD is not set.";
        console.error("[SSO] VUE_APP_NETSBLOX_SSO_PASSWORD is not set");
        return;
      }

      try {
        await auth.netsbloxLogin({
          username,
          password,
          ServerURL: this.ServerURL,
        });
      } catch (err) {
        this.isLoading = false;
        this.alertMessage =
          'NetsBlox login failed. Ensure a NetsBlox account exists for "' +
          username +
          '".';
        console.error("[SSO] NetsBlox login failed for", username, err);
        return;
      }

      // Persist identity and SSO context in the store.
      this.$store.dispatch("saveCredentials", { username, role: payload.role });
      this.$store.dispatch("setSSOContext", {
        assignmentId: payload.assignmentId || null,
        classId: payload.classId || null,
        taskId: payload.taskId || null,
        teacherEmail: payload.teacherEmail || null,
      });

      try {
        await this.setupSocket(username);
        this.$router.push({
          name: "ConstructAgent",
          params: {
            userID: username,
            projectName: payload.taskId || "default",
            source: this.ServerURL,
          },
        });
      } catch (err) {
        this.isLoading = false;
        this.alertMessage = "WebSocket connection failed. Please try again.";
        console.error("[SSO] WebSocket error:", err);
      }
    },

    toggleShow() {
      this.showPassword = !this.showPassword;
    },
    setupSocket(username) {
      return new Promise((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout after 10 seconds"));
        }, 10000); // 10 second timeout

        const onMessage = (event) => {
          if (event.data.includes("URL")) {
            let chat_URL =
              event.data.split("URL=")[1] + "?username=" + username;
            this.$store.dispatch("setAgentURL", chat_URL);
            console.log(chat_URL);
          }
          console.log(event.data);
          let state = BlockParser.generate(this.$store);
          if (state.trim().length > 1) {
            Websockets.send({ type: "state", data: state });
          }
        };

        const onClose = (event) => {
          console.log("WebSocket connection closed", event.code, event.reason);
          // The Websockets service will automatically attempt to reconnect
        };

        const onReconnect = () => {
          console.log("WebSocket reconnected successfully");
          // Optionally refresh state after reconnection
          let state = BlockParser.generate(this.$store);
          if (state.trim().length > 1) {
            Websockets.send({ type: "state", data: state });
          }
        };

        Websockets.connect(username, onMessage, onClose, onReconnect);
        this.$store.dispatch("setSocketInstance", Websockets);

        // Poll for connection status
        const checkConnection = setInterval(() => {
          if (Websockets.isConnected()) {
            clearInterval(checkConnection);
            clearTimeout(connectionTimeout);
            console.log("WebSocket connection established successfully");
            resolve();
          }
        }, 100); // Check every 100ms

        // Also handle immediate errors
        if (Websockets.socket) {
          Websockets.socket.addEventListener(
            "error",
            (error) => {
              clearInterval(checkConnection);
              clearTimeout(connectionTimeout);
              reject(new Error("WebSocket connection error: " + error.message));
            },
            { once: true }
          );
        }
      });
    },
  },
  async mounted() {
    this.emitter.on("close-alert", () => {
      this.cardActive = false;
      this.alertMessage = "";
    });

    // GENIUS SSO mode: token present in URL → hide the form and auto-login.
    const ssoToken = SSOService.getSSOToken();
    if (ssoToken) {
      this.isSSOMode = true;
      await this.ssoLogin(ssoToken);
    }
  },
};
</script>
<style scoped>
.card {
  height: fit-content;
  margin: 20px;
  width: 400px;
}
div {
  min-height: 0;
}
.login-card {
  height: 80%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.sso-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #d4d4d4;
  font-size: 1rem;
}
</style>
