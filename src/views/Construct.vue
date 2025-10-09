<template>
  <!-- Construct View for CMISE -->
  <div class="container">
    <iframe-loader
      source="https://physics.c2stem.org"
      iframeid="iframe-id"
      username="oele"
      projectname="Truck_Model_debug_HIDDEN_BLOCKS"
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
import Simulation from "../services/Simulation.js";

export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: "Construct",
  components: {
    IframeLoader,
  },
  data() {
    return {
      projectName: "Truck_Model_full_empty_HIDDEN_BLOCKS",
      api: null,
      pendingNavigation: null,
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
  beforeRouteLeave(to, from, next) {
    const projectName = this.$store.getters.getProjectName;
    if (projectName && !this.pendingNavigation) {
      this.pendingNavigation = next;

      // Call saveToCloud - wait for projectSaved event before navigating
      Simulation.saveToCloud(projectName).catch((error) => {
        console.error("Error saving project:", error);
        next();
        this.pendingNavigation = null;
      });
      // Don't call next() here - wait for projectSaved event
    } else if (this.pendingNavigation) {
      // Already saving, block navigation
      return;
    } else {
      next();
    }
  },
  mounted() {
    try {
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

      if (!iframe) {
        console.error("Construct: iframe not found");
        return;
      }

      if (!window.EmbeddedNetsBloxAPI) {
        console.error("Construct: EmbeddedNetsBloxAPI not available");
        return;
      }

      this.api = new window.EmbeddedNetsBloxAPI(iframe);
      // iframe.onload = () => {
      setTimeout(() => {
        try {
          this.api.addEventListener("projectSaved", () => {
            this.saveProject();

            // If navigation is pending, allow it to proceed
            if (this.pendingNavigation) {
              this.pendingNavigation();
              this.pendingNavigation = null;
            }
          });
          this.api.addEventListener("action", (e) => {
            try {
              if (e && e.detail && e.detail.type !== "openProject") {
                astController.actionListener(e.detail);
              }
            } catch (error) {
              console.error(
                "Construct: Error processing action event",
                error,
                e
              );
              // Continue execution - don't let one action error break everything
            }
          });
        } catch (error) {
          console.error("Construct: Error setting up event listeners", error);
        }
      }, 2000);
    } catch (error) {
      console.error("Construct: Error in mounted hook", error);
      // Continue - let the component render even if ASTController fails
    }
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
