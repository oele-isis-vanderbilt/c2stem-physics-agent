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

    <ul v-else class="lessons list-unstyled">
      <li v-for="lesson in lessons" :key="lesson.id" class="lesson">
        <div class="lesson-main">
          <div class="lesson-title">{{ lesson.title }}</div>
          <div class="lesson-meta">
            <span class="badge" :class="badgeOf(lesson).cls">
              {{ badgeOf(lesson).text }}
            </span>
            Updated by {{ lesson.updatedBy }} · {{ when(lesson.updatedAt) }}
          </div>
        </div>
        <div class="lesson-actions">
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

/** Every lesson with its publish state; New and Copy. Emits open(lessonId). */
export default {
  name: "AuthorHome",
  emits: ["open"],
  data() {
    return { lessons: [], status: "loading", busy: false };
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
  flex: 1 1 320px;
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
