<template>
  <!-- LoginView -->
  <div class="login-card">
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
          <button type="submit" class="btn btn-primary">Login</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Login View
 * @requires ../services/Auth.js that contains method for login.
 */
import auth from "../services/Auth.js";
import Token from "../services/Token.js";
// import LiveKit from "../services/LiveKit.js";
export default {
  data() {
    return {
      username: "",
      password: "",
      ServerURL: "https://physics.c2stem.org",
      cardActive: false,
      alertMessage: "",
      showPassword: false,
    };
  },
  computed: {
    currentRouteName() {
      return this.$route.name;
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
              console.log(err);
            })
            .then(async (response) => {
              if (response) {
                data.username = this.username;
                document.cookie = "username=" + data.username;
                this.$store.dispatch("saveCredentials", data);
                Token.setAccessToken(data.token);
                // try {
                //   await LiveKit.tryAndPublish(data.username, this.$store);
                // } catch (err) {
                //   console.log(err);
                // }
                this.$router.push({ name: "home" });
              }
            })
            .catch((err) => {
              console.log(err);
            });
        })
        .catch((err) => {
          console.log(err);
        });
    },

    toggleShow() {
      this.showPassword = !this.showPassword;
    },
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
</style>
