<template>
  <div>
    <p v-if="block.prompt" class="mb-2">{{ prompt }}</p>
    <p
      v-for="(line, l) in lines"
      :key="l"
      :class="line.labelled ? 'fib-labelled' : 'fib-sentence'"
    >
      <template v-for="(piece, i) in line.pieces" :key="i">
        <span v-if="piece.text !== undefined">{{ piece.text }}</span>
        <select
          v-else-if="piece.input === 'select'"
          class="form-select fib-select"
          :aria-label="piece.label"
          :value="piece.value"
          :disabled="readOnly || !piece.options.length"
          @change="update(piece.id, $event.target.value || null)"
        >
          <option value="" disabled>
            {{ piece.options.length ? "Select…" : "Answer earlier first" }}
          </option>
          <option v-for="o in piece.options" :key="o.id" :value="o.id">
            {{ o.label }}
          </option>
        </select>
        <input
          v-else
          type="text"
          class="form-control fib-input"
          :aria-label="piece.label"
          :placeholder="piece.placeholder"
          :value="piece.value"
          :readonly="readOnly"
          @input="update(piece.id, $event.target.value, true)"
          @blur="$emit('leave')"
        />
      </template>
    </p>
  </div>
</template>

<script>
import { fillRefs, optionsFrom, parseTemplate } from "../lesson";
import blockProps from "./blockProps";

/** A sentence with gaps (slides 10 and 11). Saves { blankId: value }. */
export default {
  name: "FillInBlanksBlock",
  props: blockProps,
  emits: ["answer", "leave"],
  computed: {
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
    answers() {
      return this.value || {};
    },
    lines() {
      const blanks = Object.fromEntries(
        this.block.blanks.map((b) => [b.id, b])
      );
      let count = 0;
      return parseTemplate(this.block.template).map((pieces) => {
        // "Label: [[blank]]" lines get a full-width box, like slide 11
        const labelled =
          pieces.length === 2 &&
          pieces[0].text !== undefined &&
          pieces[1].blank !== undefined;
        return {
          labelled,
          pieces: pieces.map((piece, i) => {
            if (piece.blank === undefined) {
              return { text: fillRefs(piece.text, this.ctx) };
            }
            count += 1;
            const blank = blanks[piece.blank] || { id: piece.blank };
            const before = pieces[i - 1] && pieces[i - 1].text;
            return {
              id: blank.id,
              input: blank.input,
              placeholder: blank.placeholder,
              value: this.answers[blank.id] || "",
              options: blank.optionsFrom
                ? optionsFrom(blank.optionsFrom, this.ctx)
                : blank.options || [],
              label: before
                ? before.trim().replace(/[:,]$/, "")
                : `Blank ${count}`,
            };
          }),
        };
      });
    },
  },
  methods: {
    update(blankId, text, typing = false) {
      // Build on the live answer, not the last render's copy: two gaps can
      // change before the next render (autofill), and neither may be lost.
      const live = this.ctx.answers[this.block.id] || {};
      this.$emit("answer", { ...live, [blankId]: text }, typing);
    },
  },
};
</script>

<style scoped>
.fib-sentence {
  line-height: 2.6;
  margin-bottom: 0.5rem;
}
.fib-sentence .fib-input,
.fib-sentence .fib-select {
  display: inline-block;
  width: 11em;
  max-width: 100%;
  margin: 0 4px;
  vertical-align: middle;
}
.fib-labelled {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-bottom: 0.75rem;
}
.fib-labelled .fib-input,
.fib-labelled .fib-select {
  flex: 1 1 240px;
  min-width: 0;
}
</style>
