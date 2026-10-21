<template>
  <div class="block-form">
    <key-field
      v-if="answerable"
      ref="key"
      :model-value="block.key || ''"
      :uses="uses"
      :taken="otherKeys"
      :invalid="invalid('key')"
      @commit="commitKey"
    />
    <div v-if="answerable" class="field form-check">
      <input
        :id="`optional-${block.id}`"
        class="form-check-input"
        type="checkbox"
        :checked="!!block.optional"
        @change="setOptional($event.target.checked)"
      />
      <label class="form-check-label" :for="`optional-${block.id}`">
        Optional: students can go on without answering
      </label>
    </div>

    <component
      :is="formOf"
      v-if="formOf"
      :block="block"
      :answers="answers"
      :invalid="invalid"
      :lesson="draft"
      @edit="(fn, boundary) => $emit('edit', fn, boundary)"
      @select="(sel) => $emit('select', sel)"
    />
    <div v-else class="form-later">
      <p class="mb-2">
        “{{ block.type }}” isn't a block type the form knows. Fix it in the JSON
        view.
      </p>
      <button
        type="button"
        class="btn btn-sm btn-outline-purple"
        @click="$emit('json')"
      >
        Edit in JSON
      </button>
    </div>

    <show-if-editor
      :rule="block.showIf || null"
      :answers="answers"
      :invalid="invalid('showIf')"
      @edit="(fn, boundary) => $emit('edit', fn, boundary)"
    />
  </div>
</template>

<script>
import ChoiceForm from "./blocks/ChoiceForm.vue";
import DesignTableForm from "./blocks/DesignTableForm.vue";
import FillInBlanksForm from "./blocks/FillInBlanksForm.vue";
import FreeTextForm from "./blocks/FreeTextForm.vue";
import HypothesesForm from "./blocks/HypothesesForm.vue";
import MediaForm from "./blocks/MediaForm.vue";
import SelectForm from "./blocks/SelectForm.vue";
import SimulationBlockForm from "./blocks/SimulationBlockForm.vue";
import TextForm from "./blocks/TextForm.vue";
import TrialTableForm from "./blocks/TrialTableForm.vue";
import KeyField from "./fields/KeyField.vue";
import ShowIfEditor from "./fields/ShowIfEditor.vue";
import { isAnswerable } from "../../player/lesson";
import { earlierAnswers, keyUses, keysOf, renameKey } from "../draft";

const FORMS = {
  text: TextForm,
  feedback: TextForm,
  media: MediaForm,
  freeText: FreeTextForm,
  choice: ChoiceForm,
  select: SelectForm,
  fillInBlanks: FillInBlanksForm,
  designTable: DesignTableForm,
  hypotheses: HypothesesForm,
  trialTable: TrialTableForm,
  simulation: SimulationBlockForm,
};

/**
 * One block: its answer name, Optional and Show only if, around the form
 * for its type. Emits edit(fn(block, draft), boundary) and json.
 */
export default {
  name: "BlockForm",
  components: { KeyField, ShowIfEditor },
  props: {
    block: { type: Object, required: true },
    draft: { type: Object, required: true },
    issuePaths: { type: Array, default: () => [] }, // paths inside the block
  },
  emits: ["edit", "json", "select"],
  computed: {
    formOf() {
      return FORMS[this.block.type] || null;
    },
    answerable() {
      return isAnswerable(this.block);
    },
    answers() {
      return earlierAnswers(this.draft, this.block.id);
    },
    uses() {
      return keyUses(this.draft, this.block.key);
    },
    otherKeys() {
      const keys = keysOf(this.draft);
      keys.delete(this.block.key);
      return keys;
    },
  },
  methods: {
    /** Whether the validator flagged this field or anything inside it. */
    invalid(path) {
      return this.issuePaths.some(
        (p) => p === path || p.startsWith(`${path}/`)
      );
    },
    setOptional(on) {
      this.$emit(
        "edit",
        (block) => {
          if (on) block.optional = true;
          else delete block.optional;
        },
        true
      );
    },
    commitKey(next) {
      const old = this.block.key;
      const uses = this.uses;
      let rename = false;
      if (old && uses && next) {
        rename = window.confirm(
          `${uses} place${uses === 1 ? " uses" : "s use"} “${old}”. Change ${
            uses === 1 ? "it" : "them"
          } to “${next}” too?`
        );
      } else if (old && uses && !next) {
        const ok = window.confirm(
          `${uses} place${
            uses === 1 ? " uses" : "s use"
          } “${old}”. Remove the name anyway? ${
            uses === 1 ? "It" : "They"
          } will show as issues.`
        );
        if (!ok) {
          this.$refs.key.reset();
          return;
        }
      }
      this.$emit(
        "edit",
        (block, draft) => {
          if (rename) renameKey(draft, old, next);
          else if (next) block.key = next;
          else delete block.key;
        },
        true
      );
    },
  },
};
</script>
