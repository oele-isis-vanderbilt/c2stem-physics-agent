<template>
  <div class="author-home">
    <div class="head">
      <h2 class="mb-0">Authoring</h2>
      <div class="head-actions">
        <button
          type="button"
          class="btn btn-outline-purple"
          @click="progress()"
        >
          Student progress
        </button>
        <button
          type="button"
          class="btn btn-purple"
          :disabled="busy"
          @click="create()"
        >
          + New lesson
        </button>
      </div>
    </div>

    <div v-if="status === 'loading'" class="text-center my-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
    <div v-else-if="status === 'error'" class="alert alert-warning">
      Couldn't load the lessons.
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-2"
        @click="load"
      >
        Retry
      </button>
    </div>
    <p v-else-if="!lessons.length" class="text-muted">
      No lessons yet. Start one with New lesson.
    </p>

    <template v-else>
      <div v-if="message" class="alert alert-warning py-2" role="alert">
        {{ message }}
      </div>

      <section
        v-for="group in groups"
        :key="group.id"
        class="group"
        :class="`group-${group.id}`"
      >
        <button
          type="button"
          class="group-head"
          :aria-expanded="isOpen(group.id) ? 'true' : 'false'"
          :aria-controls="`lessons-${group.id}`"
          @click="toggleGroup(group.id)"
        >
          <span class="chevron" aria-hidden="true">{{
            isOpen(group.id) ? "▾" : "▸"
          }}</span>
          {{ group.title }}
          <span class="count">{{ group.lessons.length }}</span>
        </button>
        <div v-show="isOpen(group.id)" :id="`lessons-${group.id}`">
          <p class="list-hint">{{ group.hint }}</p>
          <p v-if="!group.lessons.length" class="empty">{{ group.empty }}</p>
          <ul class="lessons list-unstyled">
            <li
              v-for="(lesson, i) in group.lessons"
              :key="lesson.id"
              class="lesson"
              :class="{ 'lesson-hidden': lesson.hidden }"
            >
              <div v-if="group.id === 'visible'" class="lesson-order">
                <button
                  type="button"
                  class="order-btn"
                  :disabled="busy || i === 0"
                  :aria-label="`Move ${lesson.title} up`"
                  title="Move up"
                  @click="move(i, -1)"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="order-btn"
                  :disabled="busy || i === group.lessons.length - 1"
                  :aria-label="`Move ${lesson.title} down`"
                  title="Move down"
                  @click="move(i, 1)"
                >
                  ↓
                </button>
              </div>
              <div class="lesson-main">
                <div class="lesson-title">{{ lesson.title }}</div>
                <div class="lesson-meta">
                  <span class="badge" :class="badgeOf(lesson).cls">
                    {{ badgeOf(lesson).text }}
                  </span>
                  Updated by {{ lesson.updatedBy }} ·
                  {{ when(lesson.updatedAt) }}
                </div>
              </div>
              <div class="lesson-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  :disabled="busy"
                  :aria-pressed="lesson.hidden ? 'true' : 'false'"
                  @click="toggleHidden(lesson)"
                >
                  {{ lesson.hidden ? "Show" : "Hide" }}
                </button>
                <button
                  v-if="lesson.latestVersion"
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  @click="progress(lesson.id)"
                >
                  Progress
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-purple"
                  @click="$emit('open', lesson.id)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-purple"
                  :disabled="busy"
                  @click="create(lesson)"
                >
                  Copy
                </button>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { inquiryApi } from "../connection";

// Which sections are open, kept for this browser only
const OPEN_KEY = "inquiry.authorHome.open";

function readOpen() {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY)) || {};
  } catch (e) {
    return {};
  }
}

/**
 * Every lesson with its publish state, in two sections: visible to students
 * (in the order they see them, reorderable) and hidden. Hide or show, New,
 * Copy, and each lesson's student progress. Emits open(lessonId).
 */
export default {
  name: "AuthorHome",
  emits: ["open"],
  data() {
    return {
      lessons: [],
      status: "loading",
      busy: false,
      message: null,
      open: { visible: true, hidden: true, ...readOpen() },
    };
  },
  computed: {
    visible() {
      return this.lessons.filter((l) => !l.hidden);
    },
    hidden() {
      return this.lessons.filter((l) => l.hidden);
    },
    groups() {
      return [
        {
          id: "visible",
          title: "Visible to students",
          lessons: this.visible,
          hint: "Students see the published lessons here, in this order. Drafts appear once published.",
          empty: "No visible lessons.",
        },
        {
          id: "hidden",
          title: "Hidden from students",
          lessons: this.hidden,
          hint: "Still published, but off the students' list. Students who started one keep their work. Shown again, a lesson returns to its place in the order.",
          empty: "No hidden lessons.",
        },
      ];
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      this.status = "loading";
      try {
        this.lessons = await inquiryApi().lessons();
        this.status = "ready";
      } catch (e) {
        this.status = "error";
      }
    },
    isOpen(id) {
      return this.open[id] !== false;
    },
    toggleGroup(id) {
      this.open = { ...this.open, [id]: !this.isOpen(id) };
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(this.open));
      } catch (e) {
        // not saved; it still works for this visit
      }
    },
    progress(lessonId) {
      this.$router.push({
        name: "InquiryProgress",
        query: lessonId ? { lessonId } : {},
      });
    },
    /** Moves a visible lesson one place and saves the whole order (hidden ones after). */
    async move(i, dir) {
      const visible = [...this.visible];
      const [lesson] = visible.splice(i, 1);
      visible.splice(i + dir, 0, lesson);
      const lessons = [...visible, ...this.hidden];
      const before = this.lessons;
      this.lessons = lessons; // show it straight away
      this.busy = true;
      this.message = null;
      try {
        this.lessons = await inquiryApi().orderLessons(
          lessons.map((l) => l.id)
        );
      } catch (e) {
        this.lessons = before;
        const code = e.response && e.response.status;
        this.message =
          code === 409
            ? "Someone added or removed a lesson since this list loaded. It has been reloaded; try again."
            : "Couldn't save the new order. Try again.";
        if (code === 409) this.load();
      } finally {
        this.busy = false;
      }
    },
    async toggleHidden(lesson) {
      const hidden = !lesson.hidden;
      if (
        hidden &&
        lesson.latestVersion &&
        !window.confirm(
          `Hide “${lesson.title}” from students? It stays published; students who started it keep their work, and it comes back when you show it.`
        )
      ) {
        return;
      }
      this.busy = true;
      this.message = null;
      try {
        const updated = await inquiryApi().setLessonHidden(lesson.id, hidden);
        this.lessons = this.lessons.map((l) =>
          l.id === updated.id ? updated : l
        );
      } catch (e) {
        this.message = `Couldn't ${
          hidden ? "hide" : "show"
        } the lesson. Try again.`;
      } finally {
        this.busy = false;
      }
    },
    badgeOf(lesson) {
      if (!lesson.latestVersion) {
        return { text: "Draft, never published", cls: "badge-draft" };
      }
      const changed =
        lesson.publishedRevision &&
        lesson.publishedRevision < lesson.draftRevision;
      return changed
        ? {
            text: `Published v${lesson.latestVersion} · unpublished changes`,
            cls: "badge-changed",
          }
        : { text: `Published v${lesson.latestVersion}`, cls: "badge-live" };
    },
    /** New lesson, or a copy of `from`; opens it in the editor. */
    async create(from) {
      const title = window.prompt(
        from ? "Title for the copy" : "Title for the new lesson",
        from ? `Copy of ${from.title}` : ""
      );
      if (!title || !title.trim()) return;
      this.busy = true;
      try {
        const lesson = await inquiryApi().createLesson(
          title.trim(),
          from && from.id
        );
        this.$emit("open", lesson.id);
      } catch (e) {
        window.alert("Couldn't create the lesson. Try again.");
      } finally {
        this.busy = false;
      }
    },
    when(iso) {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    },
  },
};
</script>

<style scoped>
.author-home {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}
.author-home div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.lesson {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: #fff;
  border: 2px solid #ddd8ea;
  border-left: 5px solid #615195;
  border-radius: 8px;
}
.lesson-main {
  min-width: 0;
  flex: 1 1 200px;
}
.lesson-order {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.order-btn {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid #ddd8ea;
  border-radius: 4px;
  background: #fff;
  color: #2e2645;
  line-height: 1;
}
.order-btn:hover:not(:disabled) {
  background: #f4f2f9;
}
.order-btn:disabled {
  opacity: 0.35;
}
.lesson-hidden {
  border-left-color: #9a94ad;
  background: #faf9fc;
}
.list-hint {
  font-size: 14px;
  color: #5c5670;
  margin: 4px 0 10px;
}
.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.group {
  margin-bottom: 18px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 2px;
  border: 0;
  border-bottom: 2px solid #ddd8ea;
  background: none;
  color: #2e2645;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: left;
}
.chevron {
  width: 1em;
  color: #615195;
}
.count {
  background: #e9e5f2;
  color: #463a73;
  border-radius: 10px;
  padding: 0 8px;
  font-size: 13px;
}
.empty {
  font-size: 14px;
  color: #5c5670;
  font-style: italic;
}
.lesson-title {
  font-weight: 600;
  color: #2e2645;
}
.lesson-meta {
  font-size: 14px;
  color: #5c5670;
}
.lesson-actions {
  display: flex;
  gap: 6px;
}
.badge {
  margin-right: 6px;
  font-weight: 600;
}
.badge-draft {
  background: #e9e5f2;
  color: #463a73;
}
.badge-live {
  background: #e7f4ec;
  color: #1e6b3a;
}
.badge-changed {
  background: #fdf1e3;
  color: #8a4b0f;
}
.btn-purple {
  background: #615195;
  border-color: #615195;
  color: #fff;
}
.btn-purple:hover:not(:disabled) {
  background: #463a73;
  color: #fff;
}
.btn-outline-purple {
  border-color: #615195;
  color: #615195;
}
.btn-outline-purple:hover:not(:disabled) {
  background: #f4f2f9;
}
</style>
