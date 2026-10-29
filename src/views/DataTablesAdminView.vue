<template>
  <div class="tables-page">
    <div class="head">
      <h2 class="mb-0">Students' data tables</h2>
      <button
        type="button"
        class="btn btn-outline-secondary"
        :disabled="status === 'loading'"
        @click="load"
      >
        Refresh
      </button>
    </div>
    <p class="hint">
      The tables students saved in the data table tool, newest first. View opens
      a read-only copy with its plot.
    </p>

    <div class="filters">
      <label>
        Lesson
        <select
          v-model="taskId"
          class="form-select form-select-sm"
          @change="load"
        >
          <option value="">All lessons</option>
          <option v-for="l in lessons" :key="l.id" :value="l.id">
            {{ l.title }}
          </option>
        </select>
      </label>
      <label>
        Student
        <input
          v-model.trim="username"
          type="search"
          class="form-control form-control-sm"
          placeholder="Name contains…"
        />
      </label>
    </div>

    <div v-if="message" class="alert alert-warning py-2" role="status">
      {{ message }}
    </div>

    <div v-if="status === 'loading'" class="text-center my-4">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <div v-else-if="status === 'error'" class="alert alert-warning">
      Couldn't load the data tables.
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-2"
        @click="load"
      >
        Retry
      </button>
    </div>
    <p v-else-if="!rows.length" class="text-muted">
      No tables match. A table appears once a student types into it.
    </p>

    <div v-else class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Lesson</th>
            <th scope="col" class="text-end">Rows</th>
            <th scope="col">Last saved</th>
            <th scope="col"><span class="visually-hidden">View</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.username + '/' + r.taskId">
            <td>{{ r.username }}</td>
            <td>{{ lessonTitle(r.taskId) }}</td>
            <td class="text-end">{{ r.rowCount }}</td>
            <td>{{ formatTime(r.updatedAt) }}</td>
            <td class="text-end">
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                :disabled="opening"
                @click="view(r)"
              >
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <data-plot-tool
      v-if="viewing"
      ref="tool"
      readonly
      :config.prop="viewing.config"
      :data.prop="viewing.doc"
    ></data-plot-tool>
  </div>
</template>

<script>
/**
 * Admin page: lists students' saved data tables and shows one read-only, with
 * its plot, in the same tool the students use.
 */
import { dataTableApi, dataTableLessons, getDataTable } from "@/datatool";

export default {
  name: "DataTablesAdminView",
  data() {
    return {
      lessons: dataTableLessons(),
      taskId: "",
      username: "",
      all: [],
      status: "idle",
      message: "",
      viewing: null,
      opening: false,
    };
  },
  computed: {
    rows() {
      const name = this.username.toLowerCase();
      return name
        ? this.all.filter((r) => r.username.toLowerCase().includes(name))
        : this.all;
    },
  },
  methods: {
    async load() {
      this.status = "loading";
      this.message = "";
      try {
        this.all = await dataTableApi.adminList({
          taskId: this.taskId || undefined,
        });
        this.status = "ready";
      } catch (error) {
        console.error("[DataTables] Could not load the list:", error);
        this.status = "error";
      }
    },
    async view(row) {
      this.opening = true;
      this.message = "";
      try {
        const doc = await dataTableApi.adminGet(row.username, row.taskId);
        if (!doc) {
          this.message = `${row.username} has no saved table for this lesson any more.`;
          return;
        }
        const config = this.configFor(row.taskId, doc);
        this.viewing = {
          doc,
          config: { ...config, title: `${config.title}: ${row.username}` },
        };
        await this.$nextTick();
        this.$refs.tool.open();
      } catch (error) {
        console.error("[DataTables] Could not load the table:", error);
        this.message = `Couldn't load ${row.username}'s table.`;
      } finally {
        this.opening = false;
      }
    },
    // A lesson no longer in src/datatool/tasks.js is shown from its saved
    // columns: the first column on x, the rest on y
    configFor(taskId, doc) {
      const known = getDataTable(taskId);
      if (known) return known;
      const keys = doc.columns.map((c) => c.key);
      return {
        title: taskId,
        columns: doc.columns,
        plot: { x: keys[0], y: keys.length > 1 ? keys.slice(1) : keys },
      };
    },
    lessonTitle(taskId) {
      const config = getDataTable(taskId);
      return config ? config.title : taskId;
    },
    formatTime(iso) {
      return iso ? new Date(iso).toLocaleString() : "";
    },
  },
  mounted() {
    this.load();
  },
};
</script>

<style scoped>
.tables-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.tables-page div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.hint {
  font-size: 14px;
  color: #5c5670;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 12px;
}
.filters label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  font-weight: 600;
  color: #2e2645;
}
</style>
