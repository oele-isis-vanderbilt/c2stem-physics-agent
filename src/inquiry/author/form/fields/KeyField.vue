<template>
  <div class="field">
    <div class="field-label">
      <label :for="id">Answer name</label>
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
      Shows this answer later as {{ example }} and names it in data exports.
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
        return "Another block already uses this name.";
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
