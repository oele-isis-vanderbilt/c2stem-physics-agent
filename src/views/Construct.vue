<template>
  <!-- Construct View for CMISE -->
  <div class="container">
    <iframe-loader
      source="https://physics.c2stem.org"
      iframeid="iframe-id"
      username="oele"
      projectname="Sloth_Model_full_empty_HIDDEN_BLOCKS"
      :embed="false"
    ></iframe-loader>
  </div>
</template>

<script>
/**
 * Construct view.
 * In this view User will have access to a C2STEM project in an iframe.
 * @requires ../components/IframeLoader.vue to display a c2stem environment in an iframe.
 */
import IframeLoader from "../components/IframeLoader.vue";
import ASTController from "../services/ASTController";
// import simulation from "../services/Simulation.js";

export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: "Construct",
  components: {
    IframeLoader,
  },
  data() {
    return {
      projectName: "Truck_Model_full_empty_HIDDEN_BLOCKS",
    };
  },
  methods: {
    saveProject() {
      this.emitter.emit("save-project", { status: true });
    },
    getUser() {
      return this.$store.state.user;
    },
  },
  mounted() {
    let blocks = this.$store.getters.getBlocks;
    let treeRoots = this.$store.getters.getTreeRoots;
    let actions = this.$store.getters.getActions;
    const astController = new ASTController(
      blocks,
      treeRoots,
      actions,
      this.$store
    );
    const iframe = document.getElementById("iframe-id");
    const api = new window.EmbeddedNetsBloxAPI(iframe);
    // iframe.onload = () => {
    setTimeout(() => {
      api.addEventListener("projectSaved", this.saveProject);
      api.addEventListener("action", (e) => {
        if (e.detail.type !== "openProject") {
          astController.actionListener(e.detail);
        }
      });
    }, 2000);
  },
};
</script>

<style scoped>
.container {
  max-width: 100%;
  height: 92%;
  padding: 0;
  background-color: #1e1e1e;
}

.btn {
  margin-right: 5px;
  margin-left: 5px;
}
.modal-body {
  display: flex;
  justify-content: center;
}
.modal-dialog {
  display: flex;
  align-items: center;
}

.modal-content {
  background-color: rgba(0, 0, 0, 0.0001) !important;
  border: 0;
}

strong {
  font-size: x-large;
  color: aliceblue;
}
</style>
