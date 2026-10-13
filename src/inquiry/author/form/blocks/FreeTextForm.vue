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
  </div>
</template>

<script>
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

/** Free text: question, sentence starter and box height. */
export default {
  name: "FreeTextForm",
  components: { TextField },
  mixins: [blockForm],
  methods: {
    setRows(text) {
      const n = parseInt(text, 10);
      this.set("rows", Number.isFinite(n) ? n : null);
    },
  },
};
</script>
