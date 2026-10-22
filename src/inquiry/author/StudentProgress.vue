<template>
  <div class="progress-page">
    <div class="head">
      <div>
        <button type="button" class="crumb" @click="$emit('back')">
          Authoring
        </button>
        <h2 class="mb-0">Student progress</h2>
      </div>
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
      Resetting deletes a student's answers in that lesson, so they start again
      from the beginning on the newest version. Research logs are kept, and the
      reset is logged. A student who has the lesson open is asked to reload.
    </p>

    <div class="filters">
      <label>
        Lesson
        <select v-model="lessonId" class="form-select form-select-sm">
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
      <label>
        Status
        <select v-model="statusFilter" class="form-select form-select-sm">
          <option value="">Any</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </label>
    </div>

    <div v-if="message" class="alert py-2" :class="messageClass" role="status">
      {{ message }}
    </div>

    <div v-if="status === 'loading'" class="text-center my-4">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <div v-else-if="status === 'error'" class="alert alert-warning">
      Couldn't load the sessions.
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-2"
        @click="load"
      >
        Retry
      </button>
    </div>
    <p v-else-if="!rows.length" class="text-muted">
      No sessions match. A session appears once a student opens a lesson.
    </p>

    <template v-else>
      <div class="bulk">
        <span>{{ rows.length }} session{{ rows.length === 1 ? "" : "s" }}</span>
        <button
          type="button"
          class="btn btn-sm btn-danger"
          :disabled="busy || !selected.length"
          @click="reset(selectedRows)"
        >
          Reset selected ({{ selected.length }})
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-sm align-middle">
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  class="form-check-input"
                  aria-label="Select all"
                  :checked="allSelected"
                  @change="selectAll($event.target.checked)"
                />
              </th>
              <th scope="col">Student</th>
              <th scope="col">Lesson</th>
              <th scope="col">Status</th>
              <th scope="col">Where</th>
              <th scope="col" class="text-end">Answers</th>
              <th scope="col">Last active</th>
              <th scope="col"><span class="visually-hidden">Reset</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <input
                  v-model="selected"
                  type="checkbox"
                  class="form-check-input"
                  :value="row.id"
                  :aria-label="`Select ${row.username}, ${titleOf(
                    row.lessonId
                  )}`"
                />
              </td>
              <td class="student">{{ row.username }}</td>
              <td>
                {{ titleOf(row.lessonId) }}
                <span class="version">v{{ row.version }}</span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="
                    row.status === 'completed' ? 'badge-done' : 'badge-going'
                  "
                >
                  {{ row.status === "completed" ? "Completed" : "In progress" }}
                </span>
              </td>
              <td class="where">
                {{ row.status === "completed" ? "—" : row.position.pageId }}
              </td>
              <td class="text-end">{{ row.answered }}</td>
              <td>{{ when(row.updatedAt) }}</td>
              <td class="text-end">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="busy"
                  @click="reset([row])"
                >
                  Reset
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import { inquiryApi } from "../connection";

/**
 * Every student's session, filtered by lesson, name or status, with Reset
 * for one or several. `initialLesson` preselects a lesson. Emits back.
 */
export default {
  name: "StudentProgress",
  props: {
    initialLesson: { type: String, default: "" },
  },
  emits: ["back"],
  data() {
    return {
      lessons: [],
      rows: [],
      status: "loading",
      busy: false,
      message: null,
      messageClass: "alert-success",
      selected: [],
      lessonId: this.initialLesson,
      username: "",
      statusFilter: "",
    };
  },
  computed: {
    selectedRows() {
      return this.rows.filter((r) => this.selected.includes(r.id));
    },
    allSelected() {
      return !!this.rows.length && this.selected.length === this.rows.length;
    },
  },
  watch: {
    lessonId() {
      this.load();
    },
    statusFilter() {
      this.load();
    },
    username() {
      // Wait for a pause in typing
      clearTimeout(this.typing);
      this.typing = setTimeout(() => this.load(), 300);
    },
  },
  async mounted() {
    try {
      this.lessons = await inquiryApi().lessons();
    } catch (e) {
      this.lessons = []; // titles fall back to ids
    }
    this.load();
  },
  beforeUnmount() {
    clearTimeout(this.typing);
  },
  methods: {
    async load() {
      const run = (this.run = (this.run || 0) + 1);
      this.status = "loading";
      try {
        const params = {};
        if (this.lessonId) params.lessonId = this.lessonId;
        if (this.username) params.username = this.username;
        if (this.statusFilter) params.status = this.statusFilter;
        const rows = await inquiryApi().sessions(params);
        if (run !== this.run) return; // a newer filter is loading
        this.rows = rows;
        this.selected = this.selected.filter((id) =>
          rows.some((r) => r.id === id)
        );
        this.status = "ready";
      } catch (e) {
        if (run === this.run) this.status = "error";
      }
    },
    titleOf(lessonId) {
      const lesson = this.lessons.find((l) => l.id === lessonId);
      return lesson ? lesson.title : lessonId;
    },
    selectAll(on) {
      this.selected = on ? this.rows.map((r) => r.id) : [];
    },
    async reset(rows) {
      if (!rows.length) return;
      const names = rows
        .slice(0, 6)
        .map((r) => `${r.username} (${this.titleOf(r.lessonId)})`)
        .join("\n");
      const more = rows.length > 6 ? `\n…and ${rows.length - 6} more` : "";
      const ok = window.confirm(
        `Reset ${rows.length} session${
          rows.length === 1 ? "" : "s"
        }? Their answers are deleted and they start again from the beginning.\n\n${names}${more}`
      );
      if (!ok) return;
      this.busy = true;
      this.message = null;
      const failed = [];
      for (const row of rows) {
        try {
          await inquiryApi().resetSession(row.id);
        } catch (e) {
          // Already gone is fine; anything else is reported
          if (!(e.response && e.response.status === 404)) failed.push(row);
        }
      }
      this.busy = false;
      const done = rows.length - failed.length;
      this.messageClass = failed.length ? "alert-warning" : "alert-success";
      this.message = failed.length
        ? `Reset ${done}; couldn't reset ${failed
            .map((r) => r.username)
            .join(", ")}. Try again.`
        : `Reset ${done} session${done === 1 ? "" : "s"}.`;
      this.selected = [];
      this.load();
    },
    when(iso) {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
  },
};
</script>

<style scoped>
.progress-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
}
.progress-page div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.crumb {
  border: 0;
  background: none;
  padding: 0;
  color: #615195;
  text-decoration: underline;
  font-size: 14px;
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
.filters .form-select,
.filters .form-control {
  min-width: 200px;
  font-weight: 400;
}
.bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 14px;
  color: #5c5670;
}
.student {
  font-weight: 600;
}
.version {
  font-size: 12px;
  color: #5c5670;
  margin-left: 4px;
}
.where {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
}
.badge-done {
  background: #e7f4ec;
  color: #1e6b3a;
}
.badge-going {
  background: #e9e5f2;
  color: #463a73;
}
</style>
