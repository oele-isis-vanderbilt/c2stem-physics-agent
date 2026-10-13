/**
 * Shared by every block type's form. `answers` are the earlier answers the
 * block may use; `invalid(path)` says whether the validator flagged a field.
 * Changes go up as edit(fn(block), boundary); boundary starts a new undo step.
 */
export default {
  props: {
    block: { type: Object, required: true },
    answers: { type: Array, default: () => [] },
    invalid: { type: Function, default: () => false },
    lesson: { type: Object, default: null }, // the whole draft, read-only
  },
  emits: ["edit"],
  methods: {
    edit(fn, boundary = false) {
      this.$emit("edit", fn, boundary);
    },
    /** Sets a field. An empty optional field is removed rather than kept as "". */
    set(field, value, { required = false, boundary = false } = {}) {
      this.edit((block) => {
        const empty = value === "" || value === undefined || value === null;
        if (empty && !required) delete block[field];
        else block[field] = value;
      }, boundary);
    },
    /** Edits a list inside the block, made empty if it is missing. */
    editInto(field, fn, boundary) {
      this.edit((block) => {
        if (!Array.isArray(block[field])) block[field] = [];
        fn(block[field]);
      }, boundary);
    },
  },
};
