<template>
  <!-- Global header for the C2STEM/SPICE/CMISE environments -->
  <nav class="navbar sticky-top navbar-expand-lg navbar-dark head">
    <div class="container-fluid">
      <button
        type="button"
        class="btn btn-link navbar-brand"
        @click="returnNav"
      >
        <img src="../assets/c2stemlogo.png" alt="" width="100" height="30" />
      </button>
      <button
        v-if="
          loggedIn &&
          (currentRouteName === 'Construct' ||
            currentRouteName === 'ConstructAgent')
        "
        type="button"
        class="btn btn-primary btn-lg me-3"
        @click="saveProject"
      >
        Save Project
      </button>
      <div class="bttn-auth ms-2 me-2">
        <button
          v-if="loggedIn && isAdmin && currentRouteName !== 'logs'"
          type="button"
          class="btn btn-primary btn-lg me-3"
          @click="$router.push('/logs')"
        >
          Logs
        </button>
        <button
          v-if="!loggedIn"
          type="button"
          class="btn btn-primary btn-lg"
          @click="$router.push('/')"
        >
          Login
        </button>
        <logout></logout>
      </div>
    </div>
  </nav>
</template>

<script>
import Logout from "./Logout.vue";
import Simulation from "../services/Simulation";

export default {
  name: "ClassHeader",
  components: {
    Logout,
  },
  computed: {
    loggedIn() {
      return this.$store.state.user;
    },
    currentRouteName() {
      return this.$route.name;
    },
    getProjectName() {
      return this.$store.state.projectName;
    },
    isAdmin() {
      return this.$store.state.role === "admin";
    },
  },
  methods: {
    async saveProject() {
      try {
        let name = this.getProjectName;
        await Simulation.saveToCloud(name);
      } catch (error) {
        console.log("Cannot save the project", error);
      }
    },
    // TO DO: need to be improved with new routes.
    returnNav() {
      this.$router.push("/home");
    },
  },
  mounted() {
    this.emitter.on("save-project", (evt) => {
      if (evt.status) {
        Simulation.publishProject(this.getProjectName, true);
      }
    });
  },
};
</script>

<style scoped>
.head {
  background: #615195;
}
.btn:focus {
  box-shadow: none;
}
</style>
