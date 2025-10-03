<template>
  <!-- Logout Component -->
  <button
    v-if="loggedIn"
    type="button"
    class="btn btn-danger btn-lg"
    @click="logout"
  >
    Logout
  </button>
</template>

<script>
/**
 * Logout Component
 * Creates a logout button on the parent component.
 * Toggles visibility based on the existence of user token  in the local storage.
 * When clicked removes credentials of current user.
 */
import authService from "@/services/Auth.js";

export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: "Logout",
  computed: {
    loggedIn() {
      return this.$store.state.user;
    },
    currentRouteName() {
      return this.$route.name;
    },
  },
  methods: {
    async logout() {
      await authService.netsbloxLogout();
      this.$store.dispatch("resetStore");
      sessionStorage.clear();
      localStorage.clear();
      this.$router.push("/");
    },
  },
};
</script>
