<template>
  <div class="lesson-preview">
    <div class="preview-bar">
      <label class="visually-hidden" for="preview-step">Preview step</label>
      <select
        id="preview-step"
        class="form-select form-select-sm"
        :value="stepAt"
        :disabled="!steps.length"
        @change="showStep(Number($event.target.value))"
      >
        <option v-for="(s, i) in steps" :key="i" :value="i">
          {{ stepLabel(s) }}
        </option>
      </select>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="!steps.length"
        @click="resetAnswers"
      >
        Reset answers
      </button>
    </div>
    <p v-if="note" class="preview-note" role="status">{{ note }}</p>
    <p v-if="problem" class="preview-problem">{{ problem }}</p>
    <div v-show="!problem" ref="host" class="preview-host"></div>
  </div>
</template>

<script>
import { createApp, h } from "vue";
import { createStore } from "vuex";
import LessonPlayer from "../player/LessonPlayer.vue";
import { allSteps, positionOf, stepIndex } from "../player/lesson";
import { createInquiryStore } from "../store";

/** Why a lesson can't be played yet, or null when it can. */
function unplayable(content) {
  if (!content || typeof content !== "object") return "No lesson to show.";
  const pages = content.pages;
  if (!Array.isArray(pages) || !pages.length) {
    return "Add at least one page to preview the lesson.";
  }
  for (const page of pages) {
    if (!page || !Array.isArray(page.steps) || !page.steps.length) {
      return "Every page needs at least one step to preview.";
    }
    for (const step of page.steps) {
      if (!step || !Array.isArray(step.blocks)) {
        return "Every step needs a blocks list to preview.";
      }
      if (step.blocks.some((b) => !b || !b.id || !b.type)) {
        return "Every block needs an id and a type to preview.";
      }
    }
  }
  return null;
}

/**
 * The real player on a lesson being edited. It runs as its own small Vue
 * app with its own store, so it never saves, logs or touches student data.
 * Any step can be picked; answers live only in memory.
 */
export default {
  name: "LessonPreview",
  props: {
    content: { type: Object, default: null },
  },
  data() {
    return { problem: null, note: null, mounts: 0 };
  },
  computed: {
    steps() {
      return unplayable(this.content) ? [] : allSteps(this.content);
    },
    stepAt() {
      this.mounts; // re-read after a remount
      const session = this.store && this.store.state.inquiry.session;
      return session ? stepIndex(this.steps, session.position) : 0;
    },
  },
  watch: {
    content() {
      this.update();
    },
  },
  mounted() {
    this.update();
  },
  beforeUnmount() {
    this.unmount();
    clearTimeout(this.noteTimer);
  },
  methods: {
    stepLabel({ page, pageIndex, step }) {
      const n = page.steps.indexOf(step) + 1;
      const steps = page.steps.length > 1 ? ` · step ${n}` : "";
      return `${pageIndex + 1}. ${page.title || page.phase || page.id}${steps}`;
    },
    update() {
      this.problem = unplayable(this.content);
      if (this.problem) return;
      if (!this.app || this.broken) {
        this.mount();
      } else {
        // Keep the author's place and answers while the lesson changes
        const { session, answers } = this.store.state.inquiry;
        this.store.commit("inquiry/setSession", {
          ...session,
          content: this.content,
          answers,
        });
      }
      this.showWanted();
    },
    mount() {
      const old = this.store && this.store.state.inquiry;
      this.unmount();

      const store = createStore({});
      const api = {
        saveSession: () => Promise.resolve({}),
        logEvents: () => Promise.resolve({ stored: 0 }),
        completeSession: () =>
          Promise.resolve({
            ...store.state.inquiry.session,
            status: "completed",
          }),
      };
      store.registerModule("inquiry", createInquiryStore(api));
      const first = allSteps(this.content)[0];
      store.commit("inquiry/setSession", {
        id: "preview",
        lessonId: "preview",
        version: 0,
        status: "in_progress",
        position: old && old.session ? old.session.position : positionOf(first),
        answers: old ? old.answers : {},
        content: this.content,
      });
      store.commit("inquiry/setLessonStatus", "ready");

      const app = createApp({
        render: () =>
          h(LessonPlayer, {
            homeLabel: "Preview",
            onFinished: () => this.restart(),
            onExit: () => {},
          }),
      });
      app.use(store);
      app.config.errorHandler = (error) => {
        // A half-edited block can break rendering; show why and rebuild on the next change
        this.broken = true;
        this.problem = `The preview couldn't show this step: ${error.message}`;
      };
      this.store = store;
      this.app = app;
      this.broken = false;
      app.mount(this.$refs.host);
      this.mounts += 1;
    },
    unmount() {
      if (this.app) this.app.unmount();
      this.app = null;
    },
    showStep(index) {
      // Straight to the step: authors aren't held up by unanswered questions
      this.store.commit("inquiry/showPosition", positionOf(this.steps[index]));
    },
    /** Shows a step by { pageId, stepId }, once the preview has it. */
    show(position) {
      this.wanted = position;
      this.showWanted();
    },
    showWanted() {
      if (!this.wanted || !this.store || this.problem) return;
      const { pageId, stepId } = this.wanted;
      const index = this.steps.findIndex(
        (s) => s.page.id === pageId && s.step.id === stepId
      );
      if (index < 0) return; // a new step; tried again after the next update
      this.wanted = null;
      if (index !== this.stepAt) this.showStep(index);
    },
    resetAnswers() {
      const { session } = this.store.state.inquiry;
      this.store.commit("inquiry/setSession", { ...session, answers: {} });
      this.flash("Preview answers cleared.");
    },
    restart() {
      const { session, answers } = this.store.state.inquiry;
      this.store.commit("inquiry/setSession", {
        ...session,
        status: "in_progress",
        position: positionOf(this.steps[0]),
        answers,
      });
      this.flash("That was the end of the lesson. Back to the start.");
    },
    flash(text) {
      this.note = text;
      clearTimeout(this.noteTimer);
      this.noteTimer = setTimeout(() => (this.note = null), 3000);
    },
  },
};
</script>

<style scoped>
.lesson-preview div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.lesson-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--inq-bg, #f1eff6);
}
.preview-bar {
  flex: 0 0 auto;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #fff;
  border-bottom: 1px solid var(--inq-line, #ddd8ea);
}
.preview-bar select {
  flex: 1 1 auto;
  min-width: 0;
}
.preview-bar button {
  flex: 0 0 auto;
}
.preview-note {
  margin: 0;
  padding: 6px 12px;
  font-size: 14px;
  background: var(--inq-tint, #f4f2f9);
  color: var(--inq-ink, #2e2645);
}
.preview-problem {
  margin: 16px;
  padding: 12px 16px;
  border-left: 4px solid #d9822b;
  background: #fff;
  color: var(--inq-ink, #2e2645);
}
.preview-host {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
</style>
