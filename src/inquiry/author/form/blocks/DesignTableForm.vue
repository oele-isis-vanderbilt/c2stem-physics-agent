<template>
  <div>
    <fieldset class="field">
      <legend class="field-label">The table is</legend>
      <div class="form-check form-check-inline">
        <input
          :id="`readonly-${block.id}`"
          class="form-check-input"
          type="radio"
          :name="`mode-${block.id}`"
          :checked="!block.editable"
          @change="setEditable(false)"
        />
        <label class="form-check-label" :for="`readonly-${block.id}`">
          Read-only (you fill it in)
        </label>
      </div>
      <div class="form-check form-check-inline">
        <input
          :id="`editable-${block.id}`"
          class="form-check-input"
          type="radio"
          :name="`mode-${block.id}`"
          :checked="!!block.editable"
          @change="setEditable(true)"
        />
        <label class="form-check-label" :for="`editable-${block.id}`">
          Filled in by students
        </label>
      </div>
    </fieldset>

    <text-field
      label="Title"
      :model-value="block.title || ''"
      :invalid="invalid('title')"
      @update:model-value="(v) => set('title', v)"
    />
    <text-field
      label="Question"
      multiline
      :rows="2"
      :model-value="block.prompt || ''"
      :refs="answers"
      :invalid="invalid('prompt')"
      @update:model-value="(v) => set('prompt', v)"
    />

    <div v-if="!block.editable" class="field">
      <div class="field-label"><span>Table</span></div>
      <static-table-editor
        :table="block"
        :invalid="invalid"
        @edit="(fn, boundary) => edit(fn, boundary)"
      />
    </div>

    <template v-else>
      <div class="field">
        <div class="field-label"><span>Column headings</span></div>
        <div class="item-row mb-1">
          <input
            type="text"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': invalid('headers') }"
            aria-label="First column heading"
            placeholder="First column (the variable), e.g. Variable"
            :value="headers[0]"
            @input="header(0, $event.target.value)"
          />
        </div>
        <ol class="list-unstyled item-list">
          <li v-for="(trial, t) in trials" :key="trial" class="item-row">
            <input
              type="text"
              class="form-control form-control-sm"
              :class="{ 'is-invalid': invalid('headers') }"
              :aria-label="`Column ${t + 2} heading`"
              placeholder="Heading, e.g. Trial A"
              :value="headers[t + 1]"
              @input="header(t + 1, $event.target.value)"
            />
            <row-tools
              :index="t"
              :count="trials.length"
              :can-remove="trials.length > 1"
              :what="`column ${t + 2}`"
              @move="(dir) => edit((b) => moveColumn(b, t, dir), true)"
              @remove="edit((b) => removeColumn(b, t), true)"
            />
          </li>
        </ol>
        <button
          type="button"
          class="btn btn-sm btn-link add-link"
          @click="edit(addColumn, true)"
        >
          + Add column
        </button>
      </div>

      <div class="field field-narrow">
        <div class="field-label">
          <label :for="`rows-${block.id}`">Rows (variables)</label>
        </div>
        <input
          :id="`rows-${block.id}`"
          type="number"
          min="1"
          max="10"
          class="form-control"
          :class="{ 'is-invalid': invalid('rowCount') }"
          :value="block.rowCount"
          @input="setRowCount($event.target.value)"
        />
      </div>

      <fieldset class="field">
        <legend class="field-label">
          Students name each row's variable by
        </legend>
        <div class="form-check form-check-inline">
          <input
            :id="`vtyped-${block.id}`"
            class="form-check-input"
            type="radio"
            :name="`variable-${block.id}`"
            :checked="!('variableOptionsFrom' in block)"
            @change="setVariableSource(false)"
          />
          <label class="form-check-label" :for="`vtyped-${block.id}`">
            Typing it
          </label>
        </div>
        <div class="form-check form-check-inline">
          <input
            :id="`vfrom-${block.id}`"
            class="form-check-input"
            type="radio"
            :name="`variable-${block.id}`"
            :checked="'variableOptionsFrom' in block"
            @change="setVariableSource(true)"
          />
          <label class="form-check-label" :for="`vfrom-${block.id}`">
            Picking one of their earlier answers
          </label>
        </div>
      </fieldset>
      <ref-list-editor
        v-if="'variableOptionsFrom' in block"
        label="Earlier answers to offer"
        :refs="block.variableOptionsFrom || []"
        :answers="answers"
        :invalid="(path) => invalid(`variableOptionsFrom/${path}`)"
        @edit="(fn, b) => editInto('variableOptionsFrom', fn, b)"
      />
    </template>
  </div>
</template>

<script>
import RefListEditor from "../fields/RefListEditor.vue";
import RowTools from "../fields/RowTools.vue";
import StaticTableEditor from "../fields/StaticTableEditor.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";
import { headersOf, trialsOf } from "../../../player/lesson";
import { addColumn, moveColumn, removeColumn, setHeader } from "../../draft";

// Fields that belong to one mode only; the other mode's wait here
const READ_ONLY_FIELDS = ["rows"];
const EDITABLE_FIELDS = ["rowCount", "variableOptionsFrom"];

/**
 * Design table: read-only rows of values, or a table students fill in
 * (typed headings, a number of rows, and a first column typed or picked
 * from earlier answers). Switching mode keeps the other mode's settings.
 */
export default {
  name: "DesignTableForm",
  components: { RefListEditor, RowTools, StaticTableEditor, TextField },
  mixins: [blockForm],
  data() {
    return { aside: {} };
  },
  computed: {
    trials() {
      return trialsOf(this.block);
    },
    headers() {
      return headersOf(this.block);
    },
  },
  methods: {
    setEditable(editable) {
      const [drop, restore] = editable
        ? [READ_ONLY_FIELDS, EDITABLE_FIELDS]
        : [EDITABLE_FIELDS, READ_ONLY_FIELDS];
      const aside = { ...this.aside };
      for (const field of drop) {
        if (field in this.block) aside[field] = this.block[field];
      }
      const back = this.aside;
      this.aside = aside;
      this.edit((block) => {
        drop.forEach((field) => delete block[field]);
        restore.forEach((field) => {
          if (field in back) block[field] = back[field];
        });
        if (editable) {
          block.editable = true;
          if (!("rowCount" in block)) block.rowCount = 2;
        } else {
          delete block.editable;
          if (!("rows" in block)) {
            // Starts empty: blank headings, 2 rows, the current columns
            const values = () =>
              Object.fromEntries(this.trials.map((t) => [t, ""]));
            block.rows = [
              { label: "", values: values() },
              { label: "", values: values() },
            ];
            if (!("headers" in block)) {
              block.headers = this.trials.map(() => "").concat("");
            }
          }
        }
      }, true);
    },
    setRowCount(text) {
      const n = parseInt(text, 10);
      this.set("rowCount", Number.isFinite(n) ? n : null);
    },
    setVariableSource(fromAnswers) {
      if (fromAnswers) {
        const kept = this.aside.variableOptionsFrom;
        this.edit((block) => {
          block.variableOptionsFrom = kept || [];
        }, true);
      } else {
        this.aside = {
          ...this.aside,
          variableOptionsFrom: this.block.variableOptionsFrom,
        };
        this.edit((block) => delete block.variableOptionsFrom, true);
      }
    },
    addColumn,
    moveColumn,
    removeColumn,
    header(i, text) {
      this.edit((block) => setHeader(block, i, text));
    },
  },
};
</script>
