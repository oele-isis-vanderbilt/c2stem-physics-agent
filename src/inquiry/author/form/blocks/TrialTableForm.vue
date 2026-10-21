<template>
  <div>
    <div class="field">
      <div class="field-label">
        <label :for="`from-${block.id}`">Hypotheses from</label>
      </div>
      <select
        :id="`from-${block.id}`"
        class="form-select form-select-sm"
        :class="{ 'is-invalid': invalid('hypothesesFrom') }"
        :value="block.hypothesesFrom || ''"
        @change="set('hypothesesFrom', $event.target.value, { boundary: true })"
      >
        <option value="" disabled>
          {{ keys.length ? "Choose…" : "Add a Hypotheses block earlier first" }}
        </option>
        <option v-for="key in keys" :key="key" :value="key">{{ key }}</option>
        <option
          v-if="block.hypothesesFrom && !keys.includes(block.hypothesesFrom)"
          :value="block.hypothesesFrom"
        >
          {{ block.hypothesesFrom }} (not an earlier Hypotheses block)
        </option>
      </select>
      <p class="field-hint">
        One table per hypothesis. Its columns are that block's independent
        variable options, and the compare dropdown offers its dependent ones.
      </p>
      <p v-if="source" class="field-hint">
        Columns: {{ labels(source.ivOptions) }}. Compare:
        {{ labels(source.dvOptions) }}.
      </p>
    </div>

    <text-field
      label="Title (optional)"
      :model-value="block.title || ''"
      :invalid="invalid('title')"
      @update:model-value="(v) => set('title', v)"
    />
    <text-field
      label="Instructions (optional)"
      multiline
      :rows="2"
      :model-value="block.prompt || ''"
      :refs="answers"
      :invalid="invalid('prompt')"
      @update:model-value="(v) => set('prompt', v)"
    />
    <text-field
      label="Compare question"
      :model-value="block.comparePrompt || ''"
      placeholder="We compare the resulting values of:"
      :invalid="invalid('comparePrompt')"
      @update:model-value="(v) => set('comparePrompt', v)"
    />

    <div class="field">
      <div class="field-label"><span>Trials (rows)</span></div>
      <div class="counts">
        <label :for="`min-${block.id}`">At least</label>
        <input
          :id="`min-${block.id}`"
          type="number"
          min="1"
          max="10"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': invalid('minTrials') }"
          :value="block.minTrials || 2"
          @input="setCount('minTrials', $event.target.value)"
        />
        <label :for="`max-${block.id}`">at most</label>
        <input
          :id="`max-${block.id}`"
          type="number"
          min="1"
          max="10"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': invalid('maxTrials') }"
          :value="block.maxTrials || 5"
          @input="setCount('maxTrials', $event.target.value)"
        />
      </div>
      <p class="field-hint">
        Students start with the least and add rows up to the most. Cells take
        numbers only.
      </p>
    </div>
  </div>
</template>

<script>
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";
import { blocksOf, hypothesesKeys } from "../../draft";

/** Trial table: which Hypotheses block it follows, its wording, and how many trials. */
export default {
  name: "TrialTableForm",
  components: { TextField },
  mixins: [blockForm],
  computed: {
    keys() {
      return this.lesson ? hypothesesKeys(this.lesson, this.block.id) : [];
    },
    source() {
      if (!this.lesson || !this.keys.includes(this.block.hypothesesFrom)) {
        return null;
      }
      const found = blocksOf(this.lesson).find(
        ({ block }) => block.key === this.block.hypothesesFrom
      );
      return found ? found.block : null;
    },
  },
  methods: {
    labels(options) {
      const list = Array.isArray(options) ? options : [];
      return list.map((o) => o.label).join(", ") || "none yet";
    },
    setCount(field, text) {
      const n = parseInt(text, 10);
      this.set(field, Number.isFinite(n) ? n : null);
    },
  },
};
</script>

<style scoped>
.counts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.counts .form-control {
  width: 5em;
}
</style>
