<template>
  <div class="inquiry-logs">
    <div class="card nav-card">
      <div class="card-body">
        <form @submit.prevent="fetchFirst">
          <label class="form-label fw-semibold mb-1" for="inq-log-user">
            Username
          </label>
          <input
            id="inq-log-user"
            :value="username"
            type="text"
            class="form-control mb-2"
            placeholder="Everyone"
            @input="$emit('update:username', $event.target.value)"
          />
          <label class="form-label fw-semibold mb-1" for="inq-log-lesson">
            Lesson
          </label>
          <select
            id="inq-log-lesson"
            v-model="lessonId"
            class="form-select mb-2"
          >
            <option value="">All lessons</option>
            <option v-for="l in lessons" :key="l.id" :value="l.id">
              {{ l.title }}
            </option>
          </select>
          <label class="form-label fw-semibold mb-1" for="inq-log-type">
            Event
          </label>
          <select id="inq-log-type" v-model="type" class="form-select mb-2">
            <option value="">All events</option>
            <option v-for="t in EVENT_TYPES" :key="t" :value="t">
              {{ t }}
            </option>
          </select>
          <button
            type="submit"
            class="btn btn-primary w-100"
            :disabled="loading"
          >
            {{ loading ? "Loading..." : "Fetch" }}
          </button>
        </form>
        <div class="form-check mt-2">
          <input
            id="inq-log-refresh"
            v-model="autoRefresh"
            class="form-check-input"
            type="checkbox"
            :disabled="!fetched"
          />
          <label class="form-check-label small" for="inq-log-refresh">
            Refresh every 10 s
          </label>
        </div>

        <div class="students mt-3">
          <div class="fw-semibold small mb-1">Students with events</div>
          <p v-if="!students.length" class="text-muted small mb-0">
            {{ studentsLoaded ? "None yet." : "Loading..." }}
          </p>
          <button
            v-for="s in students"
            :key="s.username"
            type="button"
            class="student"
            :class="{ active: s.username === username.trim() }"
            @click="pickStudent(s.username)"
          >
            <span class="student-name">{{ s.username }}</span>
            <span class="student-meta"
              >{{ s.events }} · {{ ago(s.lastAt) }}</span
            >
          </button>
        </div>
      </div>
    </div>

    <div class="card content-card">
      <div class="card-body">
        <div v-if="error" class="alert alert-warning py-2">{{ error }}</div>
        <div v-if="fetched" class="list-head">
          <span>
            {{ total }} event{{ total === 1 ? "" : "s" }} · newest first
          </span>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="!total || downloading"
            @click="download"
          >
            {{ downloading ? "Preparing..." : "Download CSV" }}
          </button>
        </div>
        <div v-if="events.length">
          <p class="hint text-muted mb-2">Click any row to expand.</p>
          <details v-for="event in events" :key="event.id" class="log-entry">
            <summary class="log-summary">
              <span class="row-where">
                {{ when(event.at) }}
                <template v-if="!filteredUser">
                  · {{ event.username }}</template
                >
                · {{ lessonTitle(event.lessonId) }}
                <template v-if="placeOf(event)">
                  · {{ placeOf(event) }}</template
                >
              </span>
              <span class="row-what">
                <strong>{{ event.type }}</strong>
                <template v-if="summarize(event)">
                  · {{ summarize(event) }}</template
                >
              </span>
            </summary>
            <pre>{{ JSON.stringify(event, null, 2) }}</pre>
          </details>
          <button
            v-if="next"
            class="btn btn-outline-secondary btn-sm mt-2"
            :disabled="loading"
            @click="fetchMore"
          >
            Load 30 more ({{ total - events.length }} remaining)
          </button>
        </div>
        <div v-else-if="fetched && !loading" class="text-muted">
          No events match.
        </div>
        <div v-else-if="!fetched" class="text-muted">
          Pick a student or a lesson, or leave both empty for everyone, and
          click Fetch.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { inquiryApi } from "../connection";
import { EVENT_TYPES, placeOf, summarize } from "./summaries";

const REFRESH_MS = 10000;

/**
 * Inquiry lesson events from the inquiry service, for the Logs page:
 * filters, the students who have events, newest-first rows that expand to
 * the full event, more on demand, optional live refresh and a CSV download.
 * The username is shared with the page (v-model:username).
 */
export default {
  name: "InquiryLogs",
  props: {
    username: { type: String, default: "" },
  },
  emits: ["update:username"],
  data() {
    return {
      EVENT_TYPES,
      lessonId: "",
      type: "",
      lessons: [],
      students: [],
      studentsLoaded: false,
      events: [],
      total: 0,
      next: null,
      fetched: false,
      loading: false,
      downloading: false,
      error: null,
      autoRefresh: false,
      contents: {}, // "lessonId@version" -> lesson content, for names
      filters: {}, // what the shown list was fetched with
    };
  },
  computed: {
    filteredUser() {
      return !!this.filters.username;
    },
  },
  watch: {
    autoRefresh(on) {
      clearInterval(this.timer);
      if (on) this.timer = setInterval(this.refresh, REFRESH_MS);
    },
    lessonId() {
      this.loadStudents();
    },
  },
  created() {
    this.api = inquiryApi();
  },
  mounted() {
    this.loadLessons();
    this.loadStudents();
  },
  beforeUnmount() {
    clearInterval(this.timer);
  },
  methods: {
    summarize(event) {
      return summarize(event, this.contentOf(event));
    },
    placeOf(event) {
      return placeOf(event, this.contentOf(event));
    },
    contentOf(event) {
      return this.contents[`${event.lessonId}@${event.version}`] || null;
    },
    lessonTitle(id) {
      const lesson = this.lessons.find((l) => l.id === id);
      return lesson ? lesson.title : id;
    },
    when(iso) {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      });
    },
    ago(iso) {
      const minutes = Math.round((Date.now() - new Date(iso)) / 60000);
      if (minutes < 1) return "now";
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.round(minutes / 60);
      return hours < 48
        ? `${hours} h ago`
        : `${Math.round(hours / 24)} days ago`;
    },
    async loadLessons() {
      try {
        this.lessons = await this.api.lessons();
      } catch (e) {
        // Titles fall back to lesson ids
      }
    },
    async loadStudents() {
      try {
        this.students = await this.api.eventStudents(
          this.lessonId || undefined
        );
      } catch (e) {
        this.students = [];
      }
      this.studentsLoaded = true;
    },
    pickStudent(name) {
      this.$emit("update:username", name);
      this.$nextTick(this.fetchFirst);
    },
    currentFilters() {
      const filters = {
        username: this.username.trim(),
        lessonId: this.lessonId,
        type: this.type,
      };
      return Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    },
    async fetchFirst() {
      this.filters = this.currentFilters();
      this.loading = true;
      this.error = null;
      try {
        const page = await this.api.events(this.filters);
        this.events = page.events;
        this.total = page.total;
        this.next = page.next;
        this.fetched = true;
        this.loadContents(page.events);
        this.loadStudents();
      } catch (e) {
        this.error = "Couldn't load events from the inquiry service.";
      } finally {
        this.loading = false;
      }
    },
    async fetchMore() {
      this.loading = true;
      try {
        const page = await this.api.events({
          ...this.filters,
          after: this.next,
        });
        this.events = [...this.events, ...page.events];
        this.total = page.total;
        this.next = page.next;
        this.loadContents(page.events);
      } catch (e) {
        this.error = "Couldn't load more events.";
      } finally {
        this.loading = false;
      }
    },
    /** Adds events newer than the first one shown, keeping pages already loaded. */
    async refresh() {
      if (this.loading || !this.fetched) return;
      try {
        const page = await this.api.events(this.filters);
        const known = new Set(this.events.map((e) => e.id));
        const fresh = [];
        for (const event of page.events) {
          if (known.has(event.id)) break;
          fresh.push(event);
        }
        if (fresh.length === page.events.length) {
          // More arrived than a page holds: start over from the newest
          this.events = page.events;
          this.next = page.next;
        } else {
          this.events = [...fresh, ...this.events];
        }
        this.total = page.total;
        this.loadContents(fresh);
        if (fresh.length) this.loadStudents();
      } catch (e) {
        // The next tick tries again
      }
    },
    /** Lesson versions the events came from, once each, for names and places. */
    async loadContents(events) {
      const wanted = new Set(
        events
          .map((e) => `${e.lessonId}@${e.version}`)
          .filter((k) => !(k in this.contents))
      );
      for (const key of wanted) {
        const [lessonId, version] = key.split("@");
        this.contents = { ...this.contents, [key]: null };
        try {
          const found = await this.api.version(lessonId, Number(version));
          this.contents = { ...this.contents, [key]: found.content };
        } catch (e) {
          // Rows keep showing ids for this lesson
        }
      }
    },
    async download() {
      this.downloading = true;
      try {
        const blob = await this.api.exportEvents(this.filters);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const who = this.filters.username || "all";
        link.href = url;
        link.download = `inquiry-events-${who}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        this.error = "Couldn't download the events.";
      } finally {
        this.downloading = false;
      }
    },
  },
};
</script>

<style scoped>
.inquiry-logs {
  display: flex;
  gap: 1rem;
  width: 100%;
  min-height: 0; /* the Logs page sizes it */
}
.card-body div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.nav-card {
  flex-shrink: 0;
  width: 280px;
  max-height: 100%;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.nav-card .card-body {
  padding: 0.75rem;
}
.content-card {
  flex: 1;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #dee2e6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
.content-card .card-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem;
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}
.hint {
  font-size: 0.8rem;
}
.student {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 0;
  border-radius: 0.25rem;
  background: none;
  font-size: 0.85rem;
  text-align: left;
}
.student:hover {
  background: #f1f3f5;
}
.student.active {
  background: #0d6efd;
  color: #fff;
}
.student-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.student-meta {
  flex-shrink: 0;
  opacity: 0.75;
}
.log-entry {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0.4rem;
}
.log-summary {
  display: block;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  user-select: none;
  list-style: none;
}
.log-summary::-webkit-details-marker {
  display: none;
}
.row-where {
  display: block;
  color: #6c757d;
  font-size: 0.78rem;
}
.row-where::before {
  content: "▶\FE0E  "; /* text arrow, not the emoji */
  font-size: 0.7rem;
}
details[open] .row-where::before {
  content: "▼ ";
}
.row-what {
  display: block;
  overflow-wrap: anywhere;
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
@media (max-width: 767.98px) {
  .inquiry-logs {
    flex-direction: column;
    overflow-y: auto;
  }
  .nav-card {
    width: 100%;
    max-height: none;
  }
  .content-card {
    height: auto;
    overflow: visible;
  }
}
</style>
