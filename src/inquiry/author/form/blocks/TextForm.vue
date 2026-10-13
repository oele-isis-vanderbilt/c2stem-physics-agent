<template>
  <div>
    <text-field
      label="Text"
      multiline
      :rows="8"
      :model-value="block.md || ''"
      :refs="answers"
      :invalid="invalid('md')"
      :hint="MARKDOWN_HINT"
      @update:model-value="(v) => set('md', v, { required: true })"
    />
    <fieldset v-if="block.type === 'feedback'" class="field">
      <legend class="field-label">Tone</legend>
      <div v-for="t in tones" :key="t.id" class="form-check form-check-inline">
        <input
          :id="`tone-${t.id}`"
          class="form-check-input"
          type="radio"
          name="tone"
          :value="t.id"
          :checked="(block.tone || 'info') === t.id"
          @change="set('tone', t.id, { boundary: true })"
        />
        <label class="form-check-label" :for="`tone-${t.id}`">{{
          t.label
        }}</label>
      </div>
    </fieldset>
  </div>
</template>

<script>
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

const MARKDOWN_HINT =
  "Markdown: **bold**, *italic*, - for a list, [link text](https://…). An inserted {{answer}} shows what the student wrote, or ___ before they answer.";

/** Text and Feedback blocks: markdown, and a tone for feedback. */
export default {
  name: "TextForm",
  components: { TextField },
  mixins: [blockForm],
  data() {
    return {
      MARKDOWN_HINT,
      tones: [
        { id: "info", label: "Note" },
        { id: "success", label: "Well done" },
        { id: "warning", label: "Careful" },
      ],
    };
  },
};
</script>
