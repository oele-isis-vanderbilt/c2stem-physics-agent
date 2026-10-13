<template>
  <div class="field">
    <div class="field-label">
      <label :for="id">{{ label }}</label>
    </div>
    <input
      :id="id"
      v-model.trim="text"
      type="text"
      class="form-control key-input"
      :class="{ 'is-invalid': problem || invalid }"
      spellcheck="false"
      autocomplete="off"
      @change="commit"
      @keydown.enter.prevent="commit"
    />
    <p v-if="problem" class="field-error">{{ problem }}</p>
    <p class="field-hint">
      <template v-if="hint">{{ hint }}</template>
      <template v-else>
        Shows this answer later as {{ example }} and names it in data exports.
      </template>
      <template v-if="uses">
        Used in {{ uses }} place{{ uses === 1 ? "" : "s" }}.
      </template>
    </p>
  </div>
</template>

<script>
const KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

/**
 * The name of a block's answer. It's only committed on Enter or leaving the
 * box, so a rename is offered once rather than on every keystroke.
 * Emits commit(key), with null to remove the name.
 */
export default {
  name: "KeyField",
  props: {
    modelValue: { type: String, default: "" },
    uses: { type: Number, default: 0 },
    taken: { type: Object, default: () => new Set() }, // other blocks' names
    invalid: { type: Boolean, default: false },
    label: { type: String, default: "Answer name" },
    hint: { type: String, default: "" }, // replaces the answer-name hint
    takenMessage: { type: String, default: "" },
  },
  emits: ["commit"],
  data() {
    return {
      id: `key-${Math.random().toString(36).slice(2)}`,
      text: this.modelValue,
    };
  },
  computed: {
    problem() {
      if (!this.text || this.text === this.modelValue) return null;
      if (!KEY.test(this.text)) {
        return "Start with a letter, then letters, digits or _ (no spaces).";
      }
      if (this.taken.has(this.text))
        return this.takenMessage || "Another block already uses this name.";
      return null;
    },
    example() {
      return `{{${this.text || this.modelValue || "name"}}}`;
    },
  },
  watch: {
    modelValue(value) {
      this.text = value; // after an undo or a cancelled rename
    },
  },
  methods: {
    commit() {
      if (this.problem || this.text === this.modelValue) return;
      this.$emit("commit", this.text || null);
    },
    reset() {
      this.text = this.modelValue;
    },
  },
};
</script>
