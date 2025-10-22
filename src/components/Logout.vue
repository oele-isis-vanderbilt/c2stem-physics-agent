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

  <!-- Full-screen loading overlay (teleported to body) -->
  <Teleport to="body">
    <div v-if="isLoggingOut" class="logout-overlay">
      <div class="logout-spinner-container">
        <div
          class="spinner-border text-light"
          role="status"
          style="width: 4rem; height: 4rem"
        >
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-light fs-4">Logging out...</p>
      </div>
    </div>
  </Teleport>
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
  data() {
    return {
      isLoggingOut: false,
    };
  },
  computed: {
    loggedIn() {
      return this.$store.state.user;
    },
    currentRouteName() {
      return this.$route.name;
    },
  },
  beforeUnmount() {
    // Ensure spinner state is reset when component is destroyed
    this.isLoggingOut = false;
  },
  methods: {
    async logout() {
      this.isLoggingOut = true;

      const currentRoute = this.$route.name;
      const projectName = this.$store.getters.getProjectName;
      let username = this.$store.state.user;

      try {
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
        await authService.logout({ username: username });
        await authService.netsbloxLogout();
        this.$store.dispatch("resetStore");
        sessionStorage.clear();
        localStorage.clear();

        // Reset spinner before navigation
        this.isLoggingOut = false;

        // Small delay to ensure spinner is hidden before route change
        // await new Promise(resolve => setTimeout(resolve, 50));

        this.$router.push("/");
      } catch (error) {
        console.error("Logout error:", error);
        this.isLoggingOut = false;
      }
    },
  },
};
</script>

<style scoped>
.logout-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.logout-spinner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
