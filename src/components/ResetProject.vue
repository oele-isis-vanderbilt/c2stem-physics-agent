<template>
  <button
    type="button"
    class="btn btn-secondary btn-lg me-3"
    @click="openModal"
    aria-hidden="true"
  >
    Reset
  </button>
  <div
    class="modal fade"
    ref="resetModal"
    data-bs-backdrop="false"
    data-bs-keyboard="false"
    tabindex="-1"
    aria-labelledby="ResetModalLabel"
    aria-hidden="true"
  >
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="ResetModalLabel">Reset Project</h5>
          <button
            type="button"
            class="btn-close"
            @click="closeModal"
            aria-label="Close"
          ></button>
        </div>
        <div class="modal-body">
          <form class="row g-3" @submit.prevent="resetProject">
            <div class="col-12">
              <label for="resetPassphraseId" class="form-label"
                >Enter passphrase to reset the project:</label
              >
              <input
                v-model="passphrase"
                type="password"
                class="form-control"
                id="resetPassphraseId"
                placeholder="Passphrase"
                autocomplete="off"
              />
            </div>
            <div class="col-12">
              <button type="submit" class="btn btn-primary" :disabled="loading">
                {{ loading ? "Resetting…" : "Reset" }}
              </button>
            </div>
          </form>
          <AlertBox :message="alertMessage" v-if="alertActive"></AlertBox>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeModal">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Modal } from "bootstrap";
import Simulation from "../services/Simulation.js";
import Auth from "../services/Auth.js";
import AlertBox from "../components/AlertBox.vue";

export default {
  name: "ResetProject",
  components: { AlertBox },
  data() {
    return {
      passphrase: "",
      alertActive: false,
      alertMessage: "",
      loading: false,
      modalInstance: null,
    };
  },
  computed: {
    projectName() {
      return this.$store.getters.getProjectName;
    },
  },
  methods: {
    openModal() {
      this.modalInstance.show();
    },
    closeModal() {
      this.alertActive = false;
      this.alertMessage = "";
      this.passphrase = "";
      this.modalInstance.hide();
    },
    showAlert(message) {
      this.alertMessage = message;
      this.alertActive = true;
    },
    async verifyPassphrase(passphrase) {
      const response = await Auth.verifyPassphrase(passphrase);
      return response.data.verified === true;
    },
    async resetProject() {
      this.loading = true;
      this.alertActive = false;
      try {
        const verified = await this.verifyPassphrase(this.passphrase);
        if (!verified) {
          this.showAlert("Reset failed: Incorrect passphrase");
          return;
        }

        const deleted = await Simulation.deleteProjectByName(this.projectName);
        if (!deleted) {
          this.showAlert("Reset failed: Could not delete project");
          return;
        }

        const stillExists = await Simulation.projectExists(this.projectName);
        if (stillExists) {
          this.showAlert("Reset failed: Please try again");
        } else {
          this.showAlert("Reset successful");
          setTimeout(() => this.$router.go(), 1500);
        }
      } catch (err) {
        this.showAlert(err.message || "Reset failed");
      } finally {
        this.loading = false;
      }
    },
  },
  mounted() {
    this.modalInstance = new Modal(this.$refs.resetModal);
    this.emitter.on("close-alert", () => {
      this.alertActive = false;
      this.alertMessage = "";
    });
  },
  beforeUnmount() {
    this.modalInstance?.dispose();
  },
};
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
}
.modal-dialog {
  width: 40%;
  height: auto;
}
</style>
