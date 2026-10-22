<template>
  <div>
    <text-field
      label="Instructions (optional)"
      multiline
      :rows="2"
      :model-value="block.prompt || ''"
      :refs="answers"
      :invalid="invalid('prompt')"
      @update:model-value="(v) => set('prompt', v)"
    />

    <div class="field form-check">
      <input
        :id="`statement-${block.id}`"
        class="form-check-input"
        type="checkbox"
        :checked="block.statement !== false"
        @change="setStatement($event.target.checked)"
      />
      <label class="form-check-label" :for="`statement-${block.id}`">
        Ask for “My hypothesis is:”
      </label>
    </div>

    <fieldset class="field">
      <legend class="field-label">Controlled variables per hypothesis</legend>
      <div v-for="n in [1, 2]" :key="n" class="form-check form-check-inline">
        <input
          :id="`cvcount-${block.id}-${n}`"
          class="form-check-input"
          type="radio"
          :name="`cvcount-${block.id}`"
          :checked="(block.controlledCount || 1) === n"
          @change="setControlledCount(n)"
        />
        <label class="form-check-label" :for="`cvcount-${block.id}-${n}`">
          {{ n === 1 ? "One" : "Two (… and …)" }}
        </label>
      </div>
      <p class="field-hint">
        Picked from the independent options the student didn't choose as
        independent{{
          (block.controlledCount || 1) === 2
            ? "; two need at least 3 independent options"
            : ""
        }}.
      </p>
    </fieldset>

    <div class="field">
      <div class="field-label"><span>Number of hypotheses</span></div>
      <div class="counts">
        <label :for="`min-${block.id}`">At least</label>
        <input
          :id="`min-${block.id}`"
          type="number"
          min="1"
          max="5"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': invalid('minHypotheses') }"
          :value="block.minHypotheses || 1"
          @input="setCount('minHypotheses', $event.target.value)"
        />
        <label :for="`max-${block.id}`">at most</label>
        <input
          :id="`max-${block.id}`"
          type="number"
          min="1"
          max="5"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': invalid('maxHypotheses') }"
          :value="block.maxHypotheses || 1"
          @input="setCount('maxHypotheses', $event.target.value)"
        />
      </div>
      <p class="field-hint">
        At most 1 is a single hypothesis, shown without the Hypothesis selector.
      </p>
    </div>

    <options-editor
      label="Independent variable options"
      :options="block.ivOptions || []"
      :min="2"
      :invalid="(path) => invalid(`ivOptions/${path}`)"
      @edit="(fn, b) => editInto('ivOptions', fn, b)"
    />
    <p class="field-hint options-note">
      The controlled variable is picked from these too, less the one chosen as
      independent. They are also the trial table's columns.
    </p>
    <options-editor
      label="Dependent variable options"
      :options="block.dvOptions || []"
      :invalid="(path) => invalid(`dvOptions/${path}`)"
      @edit="(fn, b) => editInto('dvOptions', fn, b)"
    />
    <p class="field-hint options-note">
      The trial table's “We compare the resulting values of” offers these.
    </p>

    <div class="field">
      <button
        type="button"
        class="btn btn-sm btn-outline-purple"
        :disabled="!fromVariables.ivOptions.length"
        @click="fillFromVariables"
      >
        Fill from lesson variables
      </button>
      <p class="field-hint">
        {{
          fromVariables.ivOptions.length
            ? "Inputs (sliders) become the independent options, outputs (measured) the dependent ones."
            : "Add the lesson's variables first, under Variables in the outline."
        }}
      </p>
    </div>
  </div>
</template>

<script>
import OptionsEditor from "../fields/OptionsEditor.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";
import { variableOptions } from "../../draft";

/**
 * Hypotheses: whether to ask for the statement, how many hypotheses, and the
 * independent and dependent variable options (the controlled variable comes
 * from the independent ones).
 */
export default {
  name: "HypothesesForm",
  components: { OptionsEditor, TextField },
  mixins: [blockForm],
  computed: {
    fromVariables() {
      return variableOptions(this.lesson || {});
    },
  },
  methods: {
    setStatement(on) {
      this.edit((block) => {
        block.statement = on;
      }, true);
    },
    setControlledCount(n) {
      // One is the default, so it isn't stored
      this.set("controlledCount", n === 1 ? null : n, { boundary: true });
    },
    setCount(field, text) {
      const n = parseInt(text, 10);
      this.set(field, Number.isFinite(n) ? n : null);
    },
    fillFromVariables() {
      const { ivOptions, dvOptions } = this.fromVariables;
      const ok = window.confirm(
        `Replace both option lists with the lesson's variables? Independent: ${
          ivOptions.map((o) => o.label).join(", ") || "none"
        }. Dependent: ${dvOptions.map((o) => o.label).join(", ") || "none"}.`
      );
      if (!ok) return;
      this.edit((block) => {
        block.ivOptions = ivOptions;
        block.dvOptions = dvOptions;
      }, true);
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
.options-note {
  margin: -0.5rem 0 1.25rem;
}
</style>
