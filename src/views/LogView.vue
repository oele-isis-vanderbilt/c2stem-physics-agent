<template>
  <div v-if="isAdmin" class="log-view-wrapper">
    <div class="log-view-container">
      <div class="card nav-card">
        <div class="card-body">
          <label class="form-label fw-semibold mb-1">Enter Username</label>
          <div class="input-group mb-2">
            <input
              v-model="usernameInput"
              type="text"
              class="form-control"
              placeholder="Enter username"
              @keyup.enter="fetchLogs"
            />
            <button
              class="btn btn-primary"
              @click="fetchLogs"
              :disabled="loading"
            >
              {{ loading ? "Loading..." : "Fetch" }}
            </button>
          </div>
        </div>
      </div>
      <div class="card content-card">
        <div class="card-body">
          <div class="tab-content">
            <div v-if="visibleLogs.length">
              <p class="hint text-muted mb-2">Click any row to expand.</p>
              <details
                v-for="(log, index) in visibleLogs"
                :key="index"
                class="log-entry"
              >
                <summary class="log-summary">
                  {{ index + 1 }}. {{ previewLog(log) }}
                </summary>
                <pre>{{ JSON.stringify(log, null, 2) }}</pre>
              </details>
              <button
                v-if="visibleCount < allLogs.length"
                class="btn btn-outline-secondary btn-sm mt-2"
                @click="loadMore"
              >
                Load 30 more ({{ allLogs.length - visibleCount }} remaining)
              </button>
            </div>
            <div v-else class="text-muted">
              Enter a username and click Fetch to view logs.
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
      usernameInput: "",
      allLogs: [],
      visibleCount: 30,
      loading: false,
    };
  },
  computed: {
    visibleLogs() {
      return this.allLogs.slice(0, this.visibleCount);
    },
    isAdmin() {
      return this.$store.state.role === "admin";
    },
  },
  mounted() {
    this.usernameInput = this.$store.state.user || "";
  },
  methods: {
    async fetchLogs() {
      const username = this.usernameInput.trim();
      if (!username) return;
      this.loading = true;
      this.allLogs = [];
      this.visibleCount = 30;
      const response = await Logs.getUserLogById(username);
      if (response && response.data && response.data.logs) {
        this.allLogs = response.data.logs.slice().reverse();
      }
      this.loading = false;
    },
    loadMore() {
      this.visibleCount = Math.min(this.visibleCount + 30, this.allLogs.length);
    },
    previewLog(log) {
      const parts = [];
      if (log.timestamp) {
        parts.push(new Date(log.timestamp).toLocaleString());
      }
      if (log.event_type) {
        parts.push(`event: ${log.event_type}`);
      }
      if (
        log.event_type === "action" &&
        log.raw_action &&
        log.raw_action.action_type
      ) {
        parts.push(`action: ${log.raw_action.action_type}`);
      }
      if (!parts.length) {
        parts.push(
          Object.entries(log)
            .slice(0, 2)
            .map(([k, v]) => `${k}: ${typeof v === "object" ? "{...}" : v}`)
            .join(" | ")
        );
      }
      return parts.join(" | ");
    },
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
  width: 280px;
  height: fit-content;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-card .card-body {
  padding: 0.75rem;
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

.tab-content {
  height: 100%;
  overflow-y: auto;
}

.hint {
  font-size: 0.8rem;
}

.log-entry {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0.4rem;
}

.log-summary {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  user-select: none;
  list-style: none;
}

.log-summary::-webkit-details-marker {
  display: none;
}

.log-summary::before {
  content: "▶ ";
  font-size: 0.7rem;
}

details[open] .log-summary::before {
  content: "▼ ";
}

pre {
  margin: 0;
  padding: 0.75rem;
  white-space: pre-wrap;
  word-wrap: break-word;
  border-top: 1px solid #dee2e6;
  font-size: 0.8rem;
  background: #f8f9fa;
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
