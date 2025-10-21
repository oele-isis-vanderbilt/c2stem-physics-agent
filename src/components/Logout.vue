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
      const currentRoute = this.$route.name;
      const projectName = this.$store.getters.getProjectName;

      // If on Construct or ConstructAgent page and there's a project, save it first
      if (
        (currentRoute === "Construct" || currentRoute === "ConstructAgent") &&
        projectName
      ) {
        try {
          console.log("Saving project before logout...");
          const Simulation = require("@/services/Simulation.js").default;

          // Save the project and wait for it to complete
          await Simulation.saveToCloud(projectName);
          console.log("Project saved successfully");
        } catch (error) {
          console.error("Error saving project before logout:", error);
          // Continue with logout even if save fails
        }
      }

      // Disconnect WebSocket before logout
      const socket = this.$store.getters.getSocketInstance;
      if (socket && socket.disconnect) {
        socket.disconnect();
      }

      await authService.netsbloxLogout();
      this.$store.dispatch("resetStore");
      sessionStorage.clear();
      localStorage.clear();
      this.$router.push("/");
    },
  },
};
</script>
