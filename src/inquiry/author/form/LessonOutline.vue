<template>
  <nav class="outline" aria-label="Lesson outline">
    <ul class="list-unstyled outline-top">
      <li v-for="item in topItems" :key="item.kind">
        <button
          type="button"
          class="row-btn"
          :class="{ selected: isSelected(item) }"
          :aria-current="isSelected(item) ? 'true' : null"
          @click="$emit('select', item)"
        >
          <span class="row-text">{{ item.label }}</span>
          <issue-mark :count="countOf(item)" />
        </button>
      </li>
    </ul>

    <ol class="list-unstyled outline-pages">
      <li
        v-for="(page, p) in draft.pages"
        :key="page.id || p"
        class="outline-page"
      >
        <div class="page-line">
          <button
            type="button"
            class="toggle"
            :aria-expanded="isOpen(page) ? 'true' : 'false'"
            :aria-label="`${isOpen(page) ? 'Collapse' : 'Expand'} page ${
              p + 1
            }`"
            @click="toggle(page)"
          >
            {{ isOpen(page) ? "▾" : "▸" }}
          </button>
          <button
            type="button"
            class="row-btn page-btn"
            :class="{ selected: isSelected(pageSel(page)) }"
            :aria-current="isSelected(pageSel(page)) ? 'true' : null"
            @click="$emit('select', pageSel(page))"
          >
            <span class="row-text">
              {{ p + 1 }}. {{ page.title || page.phase || "Untitled page" }}
            </span>
            <issue-mark :count="countOf(pageSel(page), true)" />
          </button>
        </div>

        <ol v-if="isOpen(page)" class="list-unstyled outline-steps">
          <li v-for="(step, s) in page.steps" :key="step.id || s">
            <button
              type="button"
              class="row-btn step-btn"
              :class="{ selected: isSelected(stepSel(page, step)) }"
              :aria-current="isSelected(stepSel(page, step)) ? 'true' : null"
              @click="$emit('select', stepSel(page, step))"
            >
              <span class="row-text">Step {{ s + 1 }}</span>
              <issue-mark :count="countOf(stepSel(page, step), true)" />
            </button>
            <ol class="list-unstyled outline-blocks">
              <li v-for="(block, b) in step.blocks" :key="block.id || b">
                <button
                  type="button"
                  class="row-btn block-btn"
                  :class="{ selected: isSelected(blockSel(page, step, block)) }"
                  :aria-current="
                    isSelected(blockSel(page, step, block)) ? 'true' : null
                  "
                  @click="$emit('select', blockSel(page, step, block))"
                >
                  <span class="row-text">
                    <span class="block-type">{{ typeLabel(block.type) }}</span>
                    <span class="block-summary">{{ blockSummary(block) }}</span>
                  </span>
                  <issue-mark :count="countOf(blockSel(page, step, block))" />
                </button>
              </li>
            </ol>
            <select
              v-if="!readOnly"
              class="form-select form-select-sm add-block"
              :aria-label="`Add a block to page ${p + 1}, step ${s + 1}`"
              value=""
              @change="addBlock($event, page, step)"
            >
              <option value="" disabled>+ Block…</option>
              <option v-for="t in BLOCK_TYPES" :key="t.type" :value="t.type">
                {{
                  t.type === "simulation" && !draft.simulation
                    ? "Simulation (needs a physics project)"
                    : t.label
                }}
              </option>
            </select>
          </li>
          <li v-if="!readOnly">
            <button
              type="button"
              class="btn btn-sm btn-link add-link"
              @click="$emit('add-step', page.id)"
            >
              + Step
            </button>
          </li>
        </ol>
      </li>
    </ol>
    <button
      v-if="!readOnly"
      type="button"
      class="btn btn-sm btn-outline-purple add-page"
      @click="$emit('add-page')"
    >
      + Page
    </button>
  </nav>
</template>

<script>
import { h } from "vue";
import { BLOCK_TYPES, blockSummary, selectionKey, typeLabel } from "../draft";

/** ⚠ and a count, or nothing when there are no issues. */
const IssueMark = {
  name: "IssueMark",
  props: { count: { type: Number, default: 0 } },
  render() {
    if (!this.count) return null;
    const what = this.count === 1 ? " issue" : " issues";
    return h("span", { class: "issue-mark" }, [
      `⚠ ${this.count}`,
      h("span", { class: "visually-hidden" }, what),
    ]);
  },
};

/**
 * Lesson settings, then pages, steps and blocks. Pages open when something
 * inside them is selected; ⚠ counts show where the validator found issues.
 */
export default {
  name: "LessonOutline",
  components: { IssueMark },
  props: {
    draft: { type: Object, required: true },
    selection: { type: Object, required: true },
    counts: { type: Object, required: true }, // { own, inside } by selectionKey
    readOnly: { type: Boolean, default: false },
  },
  emits: ["select", "add-page", "add-step", "add-block"],
  data() {
    return { BLOCK_TYPES, expanded: {} };
  },
  computed: {
    topItems() {
      const variables = Array.isArray(this.draft.variables)
        ? this.draft.variables.length
        : 0;
      return [
        { kind: "settings", label: "Lesson settings" },
        { kind: "variables", label: `Variables (${variables})` },
        { kind: "simulation", label: "Physics project" },
      ];
    },
  },
  watch: {
    selection: {
      immediate: true,
      handler(sel) {
        if (sel.pageId)
          this.expanded = { ...this.expanded, [sel.pageId]: true };
        this.$nextTick(() => {
          const row = this.$el && this.$el.querySelector(".row-btn.selected");
          if (row) row.scrollIntoView({ block: "nearest" });
        });
      },
    },
  },
  methods: {
    typeLabel,
    blockSummary,
    pageSel(page) {
      return { kind: "page", pageId: page.id };
    },
    stepSel(page, step) {
      return { kind: "step", pageId: page.id, stepId: step.id };
    },
    blockSel(page, step, block) {
      return {
        kind: "block",
        pageId: page.id,
        stepId: step.id,
        blockId: block.id,
      };
    },
    isSelected(sel) {
      return selectionKey(sel) === selectionKey(this.selection);
    },
    isOpen(page) {
      return !!this.expanded[page.id];
    },
    toggle(page) {
      this.expanded = { ...this.expanded, [page.id]: !this.isOpen(page) };
    },
    countOf(sel, inside = false) {
      const counts = this.counts[selectionKey(sel)];
      if (!counts) return 0;
      return inside ? counts.inside : counts.own;
    },
    addBlock(event, page, step) {
      const type = event.target.value;
      event.target.value = "";
      this.$emit("add-block", { pageId: page.id, stepId: step.id, type });
    },
  },
};
</script>
