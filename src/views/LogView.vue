<template>
  <div v-if="isAdmin" class="log-view-wrapper">
    <div class="log-view-container">
      <div class="card nav-card">
        <div class="card-body">
          <div
            class="nav flex-column nav-pills"
            id="v-pills-tab"
            role="tablist"
            aria-orientation="vertical"
          >
            <button
              v-for="(value, key) in users"
              :key="key"
              class="nav-link"
              id="v-pills-home-tab"
              data-bs-toggle="pill"
              data-bs-target="#v-pills-home"
              type="button"
              role="tab"
              aria-controls="v-pills-home"
              aria-selected="true"
              @click="getUserLogs(value)"
            >
              {{ value }}
            </button>
          </div>
        </div>
      </div>
      <div class="card content-card">
        <div class="card-body">
          <div class="tab-content" id="v-pills-tabContent">
            <div
              v-if="isDataVisible"
              class="tab-pane fade show active"
              id="v-pills-home"
              role="tabpanel"
              aria-labelledby="v-pills-home-tab"
              tabindex="0"
            >
              <pre>{{ JSON.stringify(getLogs, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="unauthorized-wrapper">
    <div class="alert alert-danger" role="alert">
      <h4 class="alert-heading">Access Denied</h4>
      <p>
        You do not have permission to view this page. Admin access required.
      </p>
    </div>
  </div>
</template>

<script>
import Logs from "@/services/Logs";

export default {
  name: "LogView",
  data() {
    return {
      userList: [],
      logs: {},
      dataVisible: false,
    };
  },
  computed: {
    users() {
      return this.userList;
    },
    getLogs() {
      return this.logs;
    },
    isDataVisible() {
      return this.dataVisible;
    },
    isAdmin() {
      return this.$store.state.role === "admin";
    },
  },
  methods: {
    async getUserLogs(username) {
      let response = await Logs.getUserLogById(username);
      if (response) {
        this.logs = response.data.logs;
        this.dataVisible = true;
      }
    },
  },
  async mounted() {
    let response = await Logs.getUsers();
    if (response) {
      this.userList = response.data.users;
    }
  },
};
</script>

<style scoped>
.log-view-wrapper {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  height: calc(100vh - 56px);
  padding: 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

.log-view-container {
  display: flex;
  gap: 1rem;
  height: 100%;
  width: 100%;
}

.nav-card {
  flex-shrink: 0;
  width: 250px;
  height: 100%;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav-card .card-body {
  padding: 0.5rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.nav.flex-column {
  flex-wrap: nowrap;
}

.content-card {
  flex: 1;
  height: 100%;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.content-card .card-body {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.nav-pills .nav-link {
  border: 1px solid #dee2e6;
  margin-bottom: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.nav-pills .nav-link:hover {
  background-color: #f8f9fa;
  border-color: #adb5bd;
}

.nav-pills .nav-link.active {
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.tab-content {
  height: 100%;
  overflow: hidden;
}

.tab-pane {
  height: 100%;
  overflow-y: auto;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.unauthorized-wrapper {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.unauthorized-wrapper .alert {
  max-width: 600px;
  width: 100%;
}
</style>
