<template>
  <div>
    <text-field
      label="Question"
      multiline
      :rows="2"
      :model-value="block.prompt || ''"
      :refs="answers"
      :invalid="invalid('prompt')"
      @update:model-value="(v) => set('prompt', v)"
    />
    <text-field
      label="Sentence starter"
      :model-value="block.placeholder || ''"
      :refs="answers"
      :invalid="invalid('placeholder')"
      hint="Shown faintly in the empty box, e.g. I think the cart moved because…"
      @update:model-value="(v) => set('placeholder', v)"
    />
    <div class="field field-narrow">
      <div class="field-label">
        <label :for="`rows-${block.id}`">Box height (lines)</label>
      </div>
      <input
        :id="`rows-${block.id}`"
        type="number"
        min="1"
        max="30"
        class="form-control"
        :class="{ 'is-invalid': invalid('rows') }"
        :value="block.rows"
        placeholder="3"
        @input="setRows($event.target.value)"
      />
    </div>

    <div class="field">
      <div class="form-check">
        <input
          :id="`perhyp-${block.id}`"
          class="form-check-input"
          type="checkbox"
          :checked="!!block.hypothesesFrom"
          :disabled="!keys.length && !block.hypothesesFrom"
          @change="setPerHypothesis($event.target.checked)"
        />
        <label class="form-check-label" :for="`perhyp-${block.id}`">
          Answer once for each hypothesis
        </label>
      </div>
      <p v-if="!keys.length && !block.hypothesesFrom" class="field-hint">
        Needs a Hypotheses block earlier in the lesson.
      </p>
      <div v-if="block.hypothesesFrom" class="ms-4 mt-1">
        <label :for="`perhyp-from-${block.id}`" class="form-label mb-1">
          Hypotheses from
        </label>
        <select
          :id="`perhyp-from-${block.id}`"
          class="form-select form-select-sm"
          :class="{ 'is-invalid': invalid('hypothesesFrom') }"
          :value="block.hypothesesFrom"
          @change="
            set('hypothesesFrom', $event.target.value, { boundary: true })
          "
        >
          <option v-for="key in keys" :key="key" :value="key">{{ key }}</option>
          <option
            v-if="!keys.includes(block.hypothesesFrom)"
            :value="block.hypothesesFrom"
          >
            {{ block.hypothesesFrom }} (not an earlier Hypotheses block)
          </option>
        </select>
        <p class="field-hint">
          Students pick the hypothesis above the step's questions and answer for
          each one. Other blocks can't quote this answer.
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";
import { hypothesesKeys } from "../../draft";

/** Free text: question, sentence starter, box height, and once per hypothesis. */
export default {
  name: "FreeTextForm",
  components: { TextField },
  mixins: [blockForm],
  computed: {
    keys() {
      return this.lesson ? hypothesesKeys(this.lesson, this.block.id) : [];
    },
  },
  methods: {
    setPerHypothesis(on) {
      const key = this.keys[this.keys.length - 1];
      this.set("hypothesesFrom", on ? key : null, { boundary: true });
    },
    setRows(text) {
      const n = parseInt(text, 10);
      this.set("rows", Number.isFinite(n) ? n : null);
    },
  },
};
</script>
