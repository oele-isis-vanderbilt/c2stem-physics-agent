<template>
  <div class="lesson-form">
    <div v-if="problem" class="form-problem">
      <p class="mb-2">
        {{ problem }} Fix it in the JSON view to use the form again.
      </p>
      <button
        type="button"
        class="btn btn-sm btn-purple"
        @click="$emit('json', '')"
      >
        Open JSON
      </button>
    </div>

    <template v-else>
      <lesson-outline
        v-show="wide || !showingForm"
        class="form-outline"
        :draft="draft"
        :selection="current"
        :counts="issueIndex.counts"
        :read-only="readOnly"
        @select="select"
        @add-page="addPage"
        @add-step="addStep"
        @add-block="addBlock"
      />

      <section
        v-show="wide || showingForm"
        class="form-pane"
        :aria-label="heading"
      >
        <header class="form-head">
          <button
            v-if="!wide"
            type="button"
            class="btn btn-sm btn-link back-link"
            @click="showingForm = false"
          >
            ‹ Outline
          </button>
          <h3 class="form-title">{{ heading }}</h3>
          <div class="form-tools">
            <template v-if="structural && !readOnly">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                :disabled="!canMoveBy(-1)"
                :aria-label="`Move ${what} up`"
                title="Move up"
                @click="moveBy(-1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                :disabled="!canMoveBy(1)"
                :aria-label="`Move ${what} down`"
                title="Move down"
                @click="moveBy(1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="duplicateItem"
              >
                Duplicate
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                :disabled="!removable"
                :title="removable ? '' : removeBlocked"
                @click="removeItem"
              >
                Delete
              </button>
            </template>
            <button
              type="button"
              class="btn btn-sm btn-outline-purple"
              title="Show this in the JSON view"
              @click="$emit('json', pathOf(draft, current))"
            >
              JSON
            </button>
          </div>
        </header>

        <div ref="scroll" class="form-scroll">
          <ul v-if="itemIssues.length" class="form-issues" role="list">
            <li v-for="(issue, i) in itemIssues" :key="i">
              <span v-if="issue.where" class="issue-where"
                >{{ issue.where }}:</span
              >
              {{ issue.message }}
            </li>
          </ul>

          <fieldset :disabled="readOnly" class="form-body">
            <legend class="visually-hidden">{{ heading }}</legend>

            <template v-if="current.kind === 'settings'">
              <text-field
                label="Lesson title"
                :model-value="draft.title || ''"
                :invalid="invalidAt('title')"
                @update:model-value="(v) => editLesson((d) => (d.title = v))"
              />
              <text-field
                label="Description"
                multiline
                :rows="4"
                :model-value="draft.description || ''"
                :invalid="invalidAt('description')"
                hint="Shown on the lesson's card in the students' list."
                @update:model-value="setDescription"
              />
            </template>

            <variables-form
              v-else-if="current.kind === 'variables'"
              :draft="draft"
              :invalid="lessonInvalid"
              @edit="editLesson"
            />
            <simulation-form
              v-else-if="current.kind === 'simulation'"
              :draft="draft"
              :invalid="lessonInvalid"
              @edit="editLesson"
              @select="select"
            />

            <template v-else-if="current.kind === 'page'">
              <div class="field">
                <div class="field-label">
                  <label for="page-phase">Phase</label>
                </div>
                <input
                  id="page-phase"
                  type="text"
                  class="form-control"
                  list="page-phases"
                  :class="{ 'is-invalid': invalidAt('phase') }"
                  :value="item.phase"
                  @input="
                    editItem((page) => (page.phase = $event.target.value))
                  "
                />
                <datalist id="page-phases">
                  <option
                    v-for="phase in phases"
                    :key="phase"
                    :value="phase"
                  ></option>
                </datalist>
                <p class="field-hint">
                  Shown above the page. Pages in a row with the same phase share
                  one place in the progress bar.
                </p>
              </div>
              <text-field
                label="Page title (optional)"
                :model-value="item.title || ''"
                :invalid="invalidAt('title')"
                @update:model-value="
                  (v) =>
                    editItem((page) =>
                      v ? (page.title = v) : delete page.title
                    )
                "
              />
              <p class="field-hint">
                {{ item.steps.length }} step{{
                  item.steps.length === 1 ? "" : "s"
                }}. A page with more than one step has its own Back and Next.
              </p>
            </template>

            <template v-else-if="current.kind === 'step'">
              <p v-if="!item.blocks.length" class="field-hint">
                This step is empty. Add blocks with + Block in the outline.
              </p>
              <ol v-else class="step-blocks">
                <li v-for="block in item.blocks" :key="block.id">
                  <button
                    type="button"
                    class="btn btn-link p-0 text-start"
                    @click="
                      select({ ...current, kind: 'block', blockId: block.id })
                    "
                  >
                    {{ typeLabel(block.type) }}
                  </button>
                  <span class="text-muted"> {{ blockSummary(block) }}</span>
                </li>
              </ol>
            </template>

            <block-form
              v-else-if="current.kind === 'block'"
              :key="item.id"
              :block="item"
              :draft="draft"
              :issue-paths="blockIssuePaths"
              @edit="editItem"
              @json="$emit('json', pathOf(draft, current))"
              @select="select"
            />
          </fieldset>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import BlockForm from "./BlockForm.vue";
import LessonOutline from "./LessonOutline.vue";
import SimulationForm from "./SimulationForm.vue";
import VariablesForm from "./VariablesForm.vue";
import TextField from "./fields/TextField.vue";
import {
  addBlock,
  addPage,
  addStep,
  blockSummary,
  canMove,
  canRemove,
  duplicate,
  idsInside,
  itemAt,
  locate,
  move,
  pathOf,
  remove,
  selectionKey,
  selectionOfPath,
  typeLabel,
  unformable,
} from "../draft";

const PHASES = [
  "Orientation",
  "Conceptualization",
  "Investigation",
  "Conclusion",
  "Discussion",
];

/** "options/1/label" as "options › 2 › label". */
function where(rel) {
  return (rel || "")
    .split("/")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) + 1 : part))
    .join(" › ");
}

/**
 * The lesson as an outline and a form for the selected part. Every change
 * goes through `apply(fn(draft), boundary)`, which edits a copy of the
 * draft and returns what fn returned. The selection is a v-model, so it
 * outlasts a trip to the JSON view. Emits json(path) to show a part in the
 * JSON view and show-step(position) to move the preview.
 */
export default {
  name: "LessonForm",
  components: {
    BlockForm,
    LessonOutline,
    SimulationForm,
    TextField,
    VariablesForm,
  },
  props: {
    draft: { type: Object, default: null },
    issues: { type: Array, default: null },
    readOnly: { type: Boolean, default: false },
    wide: { type: Boolean, default: true },
    apply: { type: Function, required: true },
    publishedIds: { type: Object, default: null }, // Set of ids in the latest version
    selection: { type: Object, default: () => ({ kind: "settings" }) },
  },
  emits: ["json", "show-step", "update:selection"],
  data() {
    return {
      showingForm: false,
      phases: PHASES,
    };
  },
  computed: {
    problem() {
      if (!this.draft) return "The JSON has a syntax error.";
      return unformable(this.draft);
    },
    /** The selection, or Lesson settings once what it named is gone. */
    current() {
      const { kind } = this.selection;
      if (["settings", "variables", "simulation"].includes(kind)) {
        return this.selection;
      }
      return locate(this.draft, this.selection)
        ? this.selection
        : { kind: "settings" };
    },
    item() {
      return itemAt(this.draft, this.current);
    },
    structural() {
      return ["page", "step", "block"].includes(this.current.kind);
    },
    what() {
      return this.current.kind;
    },
    heading() {
      const sel = this.current;
      if (sel.kind === "settings") return "Lesson settings";
      if (sel.kind === "variables") return "Variables";
      if (sel.kind === "simulation") return "Simulation";
      const at = locate(this.draft, sel);
      if (sel.kind === "page") return `Page ${at.p + 1}`;
      if (sel.kind === "step") return `Page ${at.p + 1} · Step ${at.s + 1}`;
      return `${typeLabel(this.item.type)} · Page ${at.p + 1}, Step ${
        at.s + 1
      }`;
    },
    removable() {
      return canRemove(this.draft, this.current);
    },
    removeBlocked() {
      return this.current.kind === "page"
        ? "A lesson needs at least one page."
        : "A page needs at least one step. Delete the page instead.";
    },
    /** Issues by the part they belong to, and ⚠ counts for the outline. */
    issueIndex() {
      const byKey = {};
      const counts = {};
      const bump = (key, field) => {
        counts[key] = counts[key] || { own: 0, inside: 0 };
        counts[key][field] += 1;
      };
      for (const issue of this.issues || []) {
        const sel = selectionOfPath(this.draft, issue.path);
        const key = selectionKey(sel);
        (byKey[key] = byKey[key] || []).push({ ...issue, rel: sel.rel || "" });
        bump(key, "own");
        if (sel.pageId)
          bump(selectionKey({ kind: "page", pageId: sel.pageId }), "inside");
        if (sel.stepId) {
          bump(
            selectionKey({
              kind: "step",
              pageId: sel.pageId,
              stepId: sel.stepId,
            }),
            "inside"
          );
        }
      }
      return { byKey, counts };
    },
    currentIssues() {
      return this.issueIndex.byKey[selectionKey(this.current)] || [];
    },
    itemIssues() {
      return this.currentIssues.map((issue) => {
        let rel = issue.rel;
        // Lesson-level paths, e.g. title, aren't inside a block
        if (!this.structural) rel = issue.path;
        if (this.current.kind === "page" || this.current.kind === "step") {
          rel = issue.path.replace(/^pages\/\d+(\/steps\/\d+)?\/?/, "");
        }
        return { message: issue.message, where: where(rel) };
      });
    },
    blockIssuePaths() {
      return this.currentIssues.map((issue) => issue.rel);
    },
  },
  methods: {
    pathOf,
    typeLabel,
    blockSummary,
    canMoveBy(dir) {
      return canMove(this.draft, this.current, dir);
    },
    /** Whether an issue names this field of the selected page or lesson. */
    invalidAt(field) {
      return this.itemIssues.some(
        (issue) => issue.where.split(" › ")[0] === field
      );
    },
    select(sel) {
      this.$emit("update:selection", sel);
      this.showingForm = true;
      if (this.$refs.scroll) this.$refs.scroll.scrollTop = 0;
      const position = this.positionOf(sel);
      if (position) this.$emit("show-step", position);
    },
    positionOf(sel) {
      if (sel.kind === "step" || sel.kind === "block") {
        return { pageId: sel.pageId, stepId: sel.stepId };
      }
      if (sel.kind === "page") {
        const page = itemAt(this.draft, sel);
        const first = page && page.steps[0];
        return first ? { pageId: page.id, stepId: first.id } : null;
      }
      return null;
    },
    /** Selects the part an issue path points at. */
    reveal(path) {
      if (this.problem) return;
      this.select(selectionOfPath(this.draft, path));
    },
    change(fn) {
      const sel = this.apply(fn, true);
      if (sel) this.select(sel);
    },
    addPage() {
      const at = locate(this.draft, this.current);
      const after = at ? at.p : this.draft.pages.length - 1;
      this.change((d) => addPage(d, after));
    },
    addStep(pageId) {
      this.change((d) =>
        addStep(
          d,
          d.pages.findIndex((p) => p.id === pageId)
        )
      );
    },
    addBlock({ pageId, stepId, type }) {
      // After the selected block when it's in this step, else at the end
      const sel = this.current;
      this.change((d) => {
        const at = locate(d, { kind: "step", pageId, stepId });
        const here =
          sel.kind === "block" && sel.stepId === stepId ? locate(d, sel) : null;
        return addBlock(d, at.p, at.s, type, here ? here.b : undefined);
      });
    },
    moveBy(dir) {
      const sel = this.current;
      this.change((d) => move(d, sel, dir));
    },
    duplicateItem() {
      const sel = this.current;
      this.change((d) => duplicate(d, sel));
    },
    removeItem() {
      const sel = this.current;
      const published =
        this.publishedIds &&
        idsInside(this.item).some((id) => this.publishedIds.has(id));
      const name =
        sel.kind === "block"
          ? `this ${typeLabel(this.item.type)} block`
          : `this ${sel.kind}`;
      const warning = published
        ? "\n\nIt's in the published lesson. Students who start after you publish again won't see it; students already in the lesson keep their version."
        : "";
      if (!window.confirm(`Delete ${name}?${warning}`)) return;
      this.change((d) => remove(d, sel));
    },
    /** Edits the selected page, step or block: fn(item, draft). */
    editItem(fn, boundary = false) {
      const sel = this.current;
      this.apply((d) => {
        fn(itemAt(d, sel), d);
      }, boundary);
    },
    editLesson(fn, boundary = false) {
      this.apply((d) => {
        fn(d);
      }, boundary);
    },
    /** For lesson-level forms: whether an issue path is this or inside it. */
    lessonInvalid(path) {
      return this.currentIssues.some(
        (issue) => issue.path === path || issue.path.startsWith(`${path}/`)
      );
    },
    setDescription(value) {
      this.editLesson((d) => {
        if (value) d.description = value;
        else delete d.description;
      });
    },
  },
};
</script>

<style>
/* Not scoped: shared by the outline and every form inside it */
.lesson-form div {
  height: auto; /* App.vue sets height: 100% on every div */
}
.lesson-form {
  display: flex;
  min-height: 0;
  background: #fff;
}
.lesson-form .form-problem {
  margin: 16px;
  padding: 12px 16px;
  border-left: 4px solid #d9822b;
  background: #fff;
}
.lesson-form .form-outline {
  flex: 0 0 260px;
  min-width: 0;
  overflow-y: auto;
  padding: 8px;
  border-right: 1px solid var(--inq-line, #ddd8ea);
  background: var(--inq-tint, #f4f2f9);
  font-size: 14px;
}
.lesson-form .form-pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
@media (max-width: 991.98px) {
  .lesson-form .form-outline {
    flex: 1 1 auto;
    border-right: 0;
  }
}
.lesson-form .form-head {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--inq-line, #ddd8ea);
}
.lesson-form .form-title {
  flex: 1 1 auto;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.lesson-form .form-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.lesson-form .form-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 24px;
}
.lesson-form .form-body {
  min-width: 0;
  max-width: 720px;
}
.lesson-form .form-issues {
  max-width: 720px;
  margin: 0 0 12px;
  padding: 8px 12px 8px 28px;
  border-left: 4px solid #b42318;
  background: #fdecea;
  font-size: 14px;
}
.lesson-form .issue-where {
  font-family: SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.lesson-form .form-later {
  padding: 12px 16px;
  margin-bottom: 12px;
  border-left: 4px solid var(--inq-purple, #615195);
  background: var(--inq-tint, #f4f2f9);
}

/* Fields */
.lesson-form .field {
  margin-bottom: 14px;
  min-width: 0;
}
.lesson-form fieldset.field {
  border: 0;
  padding: 0;
}
.lesson-form .field-narrow {
  max-width: 220px;
}
.lesson-form .field-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  margin-bottom: 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--inq-ink, #2e2645);
}
.lesson-form legend.field-label {
  float: none;
  width: auto;
}
.lesson-form .field-hint {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--inq-muted, #5c5670);
}
.lesson-form .field-error {
  margin: 4px 0 0;
  font-size: 13px;
  color: #b42318;
}
.lesson-form .insert-ref,
.lesson-form .add-ref,
.lesson-form .add-block {
  width: auto;
  max-width: 100%;
  font-weight: 400;
}
.lesson-form .insert-ref {
  max-width: 210px;
}
.lesson-form .key-input {
  max-width: 320px;
  font-family: SFMono-Regular, Menlo, Consolas, monospace;
}
.lesson-form .add-link {
  padding-left: 0;
  color: var(--inq-purple, #615195);
}
.lesson-form .is-invalid {
  border-color: #b42318;
}
.lesson-form .item-list {
  margin: 0;
}
.lesson-form .item-row-wrap {
  margin-bottom: 6px;
}
.lesson-form .item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.lesson-form .item-row > input {
  flex: 1 1 auto;
  min-width: 0;
}
.lesson-form .ref-name {
  flex: 1 1 auto;
  min-width: 0;
  padding: 4px 8px;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 4px;
  background: var(--inq-tint, #f4f2f9);
  font-size: 14px;
}
.lesson-form .row-tools {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 2px;
}
.lesson-form .tool {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 4px;
  background: #fff;
  color: var(--inq-ink, #2e2645);
  line-height: 1;
}
.lesson-form .tool:hover:not(:disabled) {
  background: var(--inq-tint, #f4f2f9);
}
.lesson-form .tool:disabled {
  opacity: 0.4;
}
.lesson-form .tool-remove:hover:not(:disabled) {
  color: #b42318;
}
.lesson-form .card-toggle {
  flex: 0 0 auto;
}
.lesson-form .option-card {
  margin: 0 0 10px 16px;
  padding: 10px 12px 2px;
  border-left: 3px solid var(--inq-line, #ddd8ea);
}
.lesson-form .table-scroll {
  overflow-x: auto;
}
.lesson-form .static-table th,
.lesson-form .static-table td {
  min-width: 90px;
}
.lesson-form .trial-head {
  display: flex;
  gap: 2px;
}
.lesson-form .show-if-rule {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  padding: 8px;
  border-radius: 4px;
  background: var(--inq-tint, #f4f2f9);
}
.lesson-form .show-if-rule > select,
.lesson-form .show-if-rule > input {
  width: auto;
  flex: 1 1 160px;
  min-width: 0;
}
.lesson-form .show-if-rule.is-invalid {
  outline: 1px solid #b42318;
}
.lesson-form .show-if-options {
  flex: 1 1 100%;
}
.lesson-form .media-item {
  margin-bottom: 12px;
  padding: 10px 12px 0;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 6px;
}
.lesson-form .media-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.lesson-form .reads-as {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.8;
}
.lesson-form .reads-as-label {
  margin-right: 6px;
  font-weight: 600;
}
.lesson-form .gap-chip {
  display: inline-block;
  padding: 0 6px;
  margin: 0 2px;
  border: 1px dashed var(--inq-purple, #615195);
  border-radius: 4px;
  background: var(--inq-tint, #f4f2f9);
  font-size: 12px;
  line-height: 1.6;
}
.lesson-form .blank-item {
  margin-bottom: 12px;
  padding: 10px 12px 2px;
  border: 1px solid var(--inq-line, #ddd8ea);
  border-radius: 6px;
}
.lesson-form .blank-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.lesson-form details > summary {
  cursor: pointer;
}
.lesson-form .summary-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--inq-ink, #2e2645);
}
@media (max-width: 575.98px) {
  .lesson-form .map-arrow {
    display: none;
  }
}
.lesson-form .step-blocks li {
  margin-bottom: 4px;
}

/* Outline */
.lesson-form .outline-top {
  margin: 0 0 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--inq-line, #ddd8ea);
}
.lesson-form .row-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--inq-ink, #2e2645);
  text-align: left;
}
.lesson-form .row-btn:hover {
  background: rgba(97, 81, 149, 0.08);
}
.lesson-form .row-btn.selected {
  background: var(--inq-purple, #615195);
  color: #fff;
}
.lesson-form .row-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lesson-form .issue-mark {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 8px;
  background: #fdecea;
  color: #b42318;
  font-size: 12px;
  font-weight: 600;
}
.lesson-form .page-line {
  display: flex;
  align-items: center;
}
.lesson-form .toggle {
  flex: 0 0 22px;
  height: 26px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--inq-muted, #5c5670);
}
.lesson-form .page-btn {
  font-weight: 600;
}
.lesson-form .outline-steps {
  margin: 0 0 6px 22px;
}
.lesson-form .outline-blocks {
  margin: 0 0 2px 10px;
}
.lesson-form .block-type {
  font-weight: 600;
}
.lesson-form .block-summary {
  margin-left: 4px;
  opacity: 0.8;
}
.lesson-form .add-block {
  margin: 2px 0 6px 10px;
}
.lesson-form .add-page {
  margin-top: 6px;
}
.lesson-form .btn-purple {
  background: var(--inq-purple, #615195);
  border-color: var(--inq-purple, #615195);
  color: #fff;
}
.lesson-form .btn-outline-purple {
  border-color: var(--inq-purple, #615195);
  color: var(--inq-purple, #615195);
}
.lesson-form .btn-outline-purple:hover:not(:disabled) {
  background: var(--inq-tint, #f4f2f9);
}
</style>
