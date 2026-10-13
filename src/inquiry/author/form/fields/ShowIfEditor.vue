<template>
  <div class="field show-if">
    <div class="form-check">
      <input
        :id="`${id}-on`"
        class="form-check-input"
        type="checkbox"
        :checked="!!rule"
        :disabled="!rule && !answers.length"
        @change="toggle($event.target.checked)"
      />
      <label class="form-check-label" :for="`${id}-on`">
        Show only if an earlier answer matches
      </label>
    </div>
    <p v-if="!rule && !answers.length" class="field-hint">
      There are no named answers before this block to depend on.
    </p>

    <div v-if="rule" class="show-if-rule" :class="{ 'is-invalid': invalid }">
      <select
        class="form-select form-select-sm"
        aria-label="Earlier answer"
        :value="rule.ref"
        @change="setRef($event.target.value)"
      >
        <option v-if="!known" :value="rule.ref">
          {{ rule.ref }} (not an earlier answer)
        </option>
        <option v-for="a in answers" :key="a.ref" :value="a.ref">
          {{ a.label }}
        </option>
      </select>
      <select
        class="form-select form-select-sm"
        aria-label="Comparison"
        :value="op"
        @change="setOp($event.target.value)"
      >
        <option value="equals">is</option>
        <option value="notEquals">is not</option>
        <option value="in">is one of</option>
      </select>

      <template v-if="options">
        <select
          v-if="op !== 'in'"
          class="form-select form-select-sm"
          aria-label="Value"
          :value="rule[op]"
          @change="setValue($event.target.value)"
        >
          <option v-for="o in options" :key="o.id" :value="o.id">
            {{ o.label }}
          </option>
        </select>
        <div v-else class="show-if-options">
          <div v-for="o in options" :key="o.id" class="form-check">
            <input
              :id="`${id}-${o.id}`"
              class="form-check-input"
              type="checkbox"
              :checked="(rule.in || []).includes(o.id)"
              @change="toggleIn(o.id, $event.target.checked)"
            />
            <label class="form-check-label" :for="`${id}-${o.id}`">
              {{ o.label }}
            </label>
          </div>
        </div>
      </template>
      <input
        v-else
        type="text"
        class="form-control form-control-sm"
        aria-label="Value"
        :placeholder="op === 'in' ? 'Values, separated by commas' : 'Value'"
        :value="op === 'in' ? inText : rule[op]"
        @input="setTyped($event.target.value)"
      />
    </div>
  </div>
</template>

<script>
const OPS = ["equals", "notEquals", "in"];

const splitValues = (text) =>
  text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * A block's showIf rule: an earlier answer, is / is not / is one of, and
 * the value. Fixed options are picked from a list; other answers are typed.
 * Emits edit(fn(block), boundary).
 */
export default {
  name: "ShowIfEditor",
  props: {
    rule: { type: Object, default: null },
    answers: { type: Array, default: () => [] },
    invalid: { type: Boolean, default: false },
  },
  emits: ["edit"],
  data() {
    return {
      id: `show-if-${Math.random().toString(36).slice(2)}`,
      inText: "", // typed "is one of" values, kept as typed
    };
  },
  computed: {
    target() {
      return this.rule && this.answers.find((a) => a.ref === this.rule.ref);
    },
    known() {
      return !!this.target;
    },
    options() {
      return this.target && this.target.options && this.target.options.length
        ? this.target.options
        : null;
    },
    joined() {
      return this.rule && Array.isArray(this.rule.in)
        ? this.rule.in.join(", ")
        : "";
    },
    op() {
      return OPS.find((op) => this.rule && op in this.rule) || "equals";
    },
  },
  watch: {
    joined: {
      immediate: true,
      handler(joined) {
        if (splitValues(this.inText).join(", ") !== joined)
          this.inText = joined;
      },
    },
  },
  methods: {
    edit(fn, boundary = true) {
      this.$emit("edit", fn, boundary);
    },
    firstValue(ref) {
      const target = this.answers.find((a) => a.ref === ref);
      const options = target && target.options;
      return options && options.length ? options[0].id : "";
    },
    toggle(on) {
      if (!on) {
        this.edit((block) => delete block.showIf);
        return;
      }
      // The nearest earlier answer is the likeliest one
      const ref = this.answers[this.answers.length - 1].ref;
      this.edit((block) => {
        block.showIf = { ref, equals: this.firstValue(ref) };
      });
    },
    setRef(ref) {
      const value = this.firstValue(ref);
      const op = this.op;
      this.edit((block) => {
        block.showIf = {
          ref,
          [op]: op === "in" ? (value ? [value] : []) : value,
        };
      });
    },
    setOp(op) {
      const old = this.rule[this.op];
      let value;
      if (op === "in")
        value = Array.isArray(old) ? old : old === "" ? [] : [old];
      else value = Array.isArray(old) ? old[0] || "" : old;
      const ref = this.rule.ref;
      this.edit((block) => {
        block.showIf = { ref, [op]: value };
      });
    },
    setValue(value) {
      const op = this.op;
      this.edit((block) => {
        block.showIf[op] = value;
      });
    },
    toggleIn(id, on) {
      const chosen = new Set(this.rule.in || []);
      if (on) chosen.add(id);
      else chosen.delete(id);
      // Keep the options' order
      const values = this.options.map((o) => o.id).filter((v) => chosen.has(v));
      this.edit((block) => {
        block.showIf.in = values;
      });
    },
    setTyped(text) {
      const op = this.op;
      if (op === "in") this.inText = text;
      const value = op === "in" ? splitValues(text) : text;
      this.edit((block) => {
        block.showIf[op] = value;
      }, false);
    },
  },
};
</script>
