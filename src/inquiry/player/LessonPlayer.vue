<template>
  <div class="inquiry-player" :style="fitStyle">
    <header class="lesson-bar">
      <div class="bar-top">
        <nav aria-label="Breadcrumb" class="crumbs">
          <button type="button" class="crumb-link" @click="$emit('exit')">
            {{ homeLabel }}
          </button>
          <span class="crumb-sep" aria-hidden="true">/</span>
          <span class="crumb-current">{{ session.content.title }}</span>
        </nav>
        <span class="save-status" role="status">{{ statusLabel }}</span>
      </div>

      <ol class="stepper" aria-label="Lesson phases">
        <li
          v-for="(phase, i) in phaseItems"
          :key="i"
          :class="phase.state"
          :aria-current="phase.state === 'current' ? 'step' : null"
        >
          <span class="dot">
            <svg
              v-if="phase.state === 'done'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              aria-hidden="true"
            >
              <path d="M5 12l5 5 9-10"></path>
            </svg>
            <template v-else>{{ i + 1 }}</template>
          </span>
          {{ phase.name }}
        </li>
      </ol>
      <p class="stepper-compact">
        Phase {{ place.phaseIndex + 1 }} of {{ phases.length }} ·
        {{ phases[place.phaseIndex].name }}
      </p>
    </header>

    <div class="lesson-body">
      <h2 v-if="current.page.title" class="page-title">
        {{ current.page.title }}
      </h2>

      <div ref="card" class="step-card">
        <!-- Progress through a page's inner steps, like the slides' inner Back/Next -->
        <div
          v-if="pageSteps.length > 1"
          class="step-dots"
          role="img"
          :aria-label="`Step ${pageStep + 1} of ${
            pageSteps.length
          } on this page`"
        >
          <span
            v-for="(s, i) in pageSteps"
            :key="s.id"
            :class="{ done: i < pageStep, current: i === pageStep }"
          ></span>
        </div>
        <block-renderer
          v-for="block in current.step.blocks"
          :key="block.id"
          :block="block"
          :ctx="ctx"
          :read-only="readOnly"
        />
      </div>

      <div class="nav-bar">
        <button
          v-if="index > 0"
          type="button"
          class="btn btn-back"
          @click="move(-1)"
        >
          Back
        </button>
        <span class="step-count">
          Step {{ place.step }} of {{ place.stepCount }} in this phase
        </span>
        <button
          v-if="!isLast"
          type="button"
          class="btn btn-next"
          :disabled="!canNext"
          :title="canNext ? '' : 'Answer the questions above to continue'"
          @click="move(1)"
        >
          Next
        </button>
        <button
          v-else-if="!readOnly"
          type="button"
          class="btn btn-next"
          :disabled="!canNext || finishing"
          :title="canNext ? '' : 'Answer the questions above to finish'"
          @click="finish"
        >
          Finish
        </button>
        <button
          v-else
          type="button"
          class="btn btn-next"
          @click="$emit('exit')"
        >
          Back to lessons
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import BlockRenderer from "./BlockRenderer.vue";
import {
  allSteps,
  canContinue,
  keyIndex,
  phaseOf,
  phasesOf,
  positionOf,
  staleAnswers,
  stepIndex,
} from "./lesson";

// Below this the page scrolls instead; a very short window can't fit the card.
const MIN_HEIGHT = 420;

const SAVE_LABELS = {
  saved: "All changes saved",
  saving: "Saving…",
  retrying: "Couldn't save, retrying",
  loginRequired: "Please log in again",
};

/** Plays the open session in the inquiry store. Emits finished and exit. */
export default {
  name: "LessonPlayer",
  components: { BlockRenderer },
  props: {
    homeLabel: { type: String, default: "Inquiry" }, // first breadcrumb
  },
  emits: ["finished", "exit"],
  data() {
    return { finishing: false, fitHeight: null };
  },
  computed: {
    ...mapState("inquiry", ["session", "answers", "saveStatus"]),
    ...mapGetters("inquiry", ["readOnly"]),
    steps() {
      return allSteps(this.session.content);
    },
    phases() {
      return phasesOf(this.session.content);
    },
    blocksByKey() {
      return keyIndex(this.session.content);
    },
    ctx() {
      return {
        answers: this.answers,
        blocksByKey: this.blocksByKey,
        lesson: this.session.content,
      };
    },
    index() {
      return stepIndex(this.steps, this.session.position);
    },
    current() {
      return this.steps[this.index];
    },
    place() {
      return phaseOf(this.steps, this.phases, this.index);
    },
    pageSteps() {
      return this.current.page.steps;
    },
    pageStep() {
      return this.pageSteps.indexOf(this.current.step);
    },
    phaseItems() {
      return this.phases.map((phase, i) => {
        let state = "todo";
        if (this.readOnly || i < this.place.phaseIndex) state = "done";
        else if (i === this.place.phaseIndex) state = "current";
        return { name: phase.name, state };
      });
    },
    isLast() {
      return this.index === this.steps.length - 1;
    },
    canNext() {
      return this.readOnly || canContinue(this.current.step, this.ctx);
    },
    statusLabel() {
      return this.readOnly ? "Completed" : SAVE_LABELS[this.saveStatus];
    },
    fitStyle() {
      return this.fitHeight
        ? { height: `${this.fitHeight}px`, minHeight: 0 }
        : {};
    },
  },
  watch: {
    index: { handler: "clearStale", immediate: true },
  },
  mounted() {
    this.fit();
    window.addEventListener("resize", this.fit);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.fit);
  },
  methods: {
    // Fill the window below whatever the host app puts above the player, so
    // Back/Next stay in view and only the step card scrolls.
    fit() {
      const top = this.$el.getBoundingClientRect().top + window.scrollY;
      this.fitHeight = Math.max(window.innerHeight - top, MIN_HEIGHT);
    },
    // A dropdown of earlier answers keeps its pick only while that answer is
    // still one of the options; otherwise the student picks again.
    clearStale() {
      if (this.readOnly) return;
      for (const { blockId, value } of staleAnswers(
        this.current.step,
        this.ctx
      )) {
        this.$store.dispatch("inquiry/setAnswer", {
          blockId,
          value,
          log: false, // cleared by the player, not the student
        });
      }
    },
    move(delta) {
      const target = this.steps[this.index + delta];
      if (!target) return;
      this.$store.dispatch("inquiry/goTo", positionOf(target));
      this.$refs.card.scrollTop = 0;
    },
    async finish() {
      const ok = window.confirm(
        "Finish this lesson? You won't be able to change your answers."
      );
      if (!ok) return;
      this.finishing = true;
      try {
        if (await this.$store.dispatch("inquiry/complete")) {
          this.$emit("finished");
          return;
        }
      } catch (error) {
        // Stay on the page; the save status shows what went wrong.
      }
      this.finishing = false;
    },
  },
};
</script>

<style>
/* App.vue sets height and max-width on every div; the player sizes its own. */
.inquiry-player div {
  height: auto;
}
.inquiry-player .row {
  max-width: none;
}
</style>

<style scoped>
.inquiry-player {
  --inq-purple: #615195;
  --inq-purple-dark: #463a73;
  --inq-ink: #2e2645;
  --inq-tint: #f4f2f9;
  --inq-line: #ddd8ea;
  --inq-soft-border: #cfc9df;
  --inq-muted: #5c5670;
  --inq-row1: #e9e5f2;
  --inq-row2: #f5f3fa;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: calc(100vh - 64px); /* until fit() measures the real space */
  background: var(--inq-tint);
  color: #212529;
  padding-bottom: 16px;
}

/* Lesson bar */
.lesson-bar {
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid var(--inq-line);
  padding: 14px 24px;
}
.bar-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.crumbs {
  font-size: 15px;
}
.crumb-link {
  background: none;
  border: 0;
  padding: 0;
  color: var(--inq-purple);
  text-decoration: underline;
}
.crumb-link:hover {
  color: var(--inq-purple-dark);
}
.crumb-sep {
  color: #8a84a0;
  margin: 0 8px;
}
.crumb-current {
  font-weight: 600;
}
.save-status {
  font-size: 14px;
  color: var(--inq-muted);
}

/* Phase stepper */
.stepper {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  font-size: 14px;
}
.stepper li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6c6880;
}
.stepper .dot {
  width: 24px;
  height: 24px;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1px solid #b6b0c8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.stepper li.done {
  color: var(--inq-purple-dark);
}
.stepper li.done .dot {
  background: var(--inq-purple);
  border-color: var(--inq-purple);
  color: #fff;
}
.stepper li.current {
  color: var(--inq-purple-dark);
  font-weight: 700;
}
.stepper li.current .dot {
  border: 3px solid var(--inq-purple);
  background: #fff;
}
.stepper-compact {
  display: none;
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--inq-purple-dark);
}
@media (max-width: 575.98px) {
  .lesson-bar {
    padding: 12px 16px;
  }
  .stepper {
    display: none;
  }
  .stepper-compact {
    display: block;
  }
}

/* Step card and navigation */
.lesson-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 1080px;
  box-sizing: border-box;
  margin: 20px auto 0;
  padding: 0 16px;
}
.page-title {
  flex-shrink: 0;
  font-size: 1.25rem;
  color: var(--inq-ink);
  margin-bottom: 12px;
}
/* Shrinks to fit its content; scrolls when the content is taller than the space */
.step-card {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  background: #fff;
  border: 3px solid var(--inq-purple);
  border-radius: 8px;
  --card-pad: 28px;
  padding: var(--card-pad);
}
@media (max-width: 575.98px) {
  .step-card {
    --card-pad: 18px;
  }
}
/* Pinned to the card's top edge while its content scrolls underneath */
.step-dots {
  position: sticky;
  top: calc(-1 * var(--card-pad));
  z-index: 1;
  display: flex;
  justify-content: center;
  gap: 8px;
  background: #fff;
  padding: var(--card-pad) 0 12px;
  margin: calc(-1 * var(--card-pad)) 0 8px;
}
.step-dots span {
  width: 10px;
  height: 10px;
  border-radius: 5px;
  background: var(--inq-soft-border);
}
.step-dots span.done {
  background: var(--inq-purple);
}
.step-dots span.current {
  width: 26px;
  background: var(--inq-purple);
}
.nav-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
.step-count {
  flex: 1;
  text-align: center;
  font-size: 14px;
  color: var(--inq-muted);
}
.btn-back,
.btn-next {
  border: 2px solid var(--inq-purple);
  border-radius: 8px;
  padding: 10px 28px;
  font-weight: 600;
}
.btn-back {
  background: #fff;
  color: var(--inq-purple);
}
.btn-back:hover {
  background: var(--inq-tint);
  color: var(--inq-purple-dark);
}
.btn-next {
  background: var(--inq-purple);
  color: #fff;
}
.btn-next:hover {
  background: var(--inq-purple-dark);
  border-color: var(--inq-purple-dark);
  color: #fff;
}
.btn-next:disabled {
  background: #b3abcf;
  border-color: #b3abcf;
  color: #fff;
  opacity: 1;
}
</style>
