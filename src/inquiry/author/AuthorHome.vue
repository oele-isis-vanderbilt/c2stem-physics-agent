<template>
  <div class="author-home">
    <div class="head">
      <h2 class="mb-0">Authoring</h2>
      <button
        type="button"
        class="btn btn-purple"
        :disabled="busy"
        @click="create()"
      >
        + New lesson
      </button>
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
    <p v-else class="list-hint">
      Students see published lessons in this order. Hidden lessons stay
      published but are off their list.
    </p>
    <div v-if="message" class="alert alert-warning py-2" role="alert">
      {{ message }}
    </div>

    <ul v-else class="lessons list-unstyled">
      <li
        v-for="(lesson, i) in lessons"
        :key="lesson.id"
        class="lesson"
        :class="{ 'lesson-hidden': lesson.hidden }"
      >
        <div class="lesson-order">
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
            :disabled="busy || i === lessons.length - 1"
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
            <span v-if="lesson.hidden" class="badge badge-hidden">
              Hidden from students
            </span>
            Updated by {{ lesson.updatedBy }} · {{ when(lesson.updatedAt) }}
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
</template>

<script>
import { inquiryApi } from "../connection";

/**
 * Every lesson with its publish state, in the order students see them:
 * reorder, hide or show, New and Copy. Emits open(lessonId).
 */
export default {
  name: "AuthorHome",
  emits: ["open"],
  data() {
    return { lessons: [], status: "loading", busy: false, message: null };
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
    /** Moves a lesson one place and saves the whole order. */
    async move(i, dir) {
      const lessons = [...this.lessons];
      const [lesson] = lessons.splice(i, 1);
      lessons.splice(i + dir, 0, lesson);
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
.badge-hidden {
  background: #ececf0;
  color: #4a4658;
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
