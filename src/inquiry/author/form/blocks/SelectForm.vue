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
    <fieldset class="field">
      <legend class="field-label">Options come from</legend>
      <div class="form-check form-check-inline">
        <input
          :id="`fixed-${block.id}`"
          class="form-check-input"
          type="radio"
          :name="`source-${block.id}`"
          :checked="!fromAnswers"
          @change="useFixed"
        />
        <label class="form-check-label" :for="`fixed-${block.id}`">
          A fixed list
        </label>
      </div>
      <div class="form-check form-check-inline">
        <input
          :id="`from-${block.id}`"
          class="form-check-input"
          type="radio"
          :name="`source-${block.id}`"
          :checked="fromAnswers"
          @change="useAnswers"
        />
        <label class="form-check-label" :for="`from-${block.id}`">
          The student's earlier answers
        </label>
      </div>
    </fieldset>

    <ref-list-editor
      v-if="fromAnswers"
      label="Earlier answers to offer"
      :refs="block.optionsFrom || []"
      :answers="answers"
      :invalid="(path) => invalid(`optionsFrom/${path}`)"
      @edit="(fn, b) => editInto('optionsFrom', fn, b)"
    />
    <options-editor
      v-else
      :options="block.options || []"
      :invalid="(path) => invalid(`options/${path}`)"
      @edit="(fn, b) => editInto('options', fn, b)"
    />
  </div>
</template>

<script>
import OptionsEditor from "../fields/OptionsEditor.vue";
import RefListEditor from "../fields/RefListEditor.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

/** Dropdown: a fixed list of options, or options from earlier answers. */
export default {
  name: "SelectForm",
  components: { OptionsEditor, RefListEditor, TextField },
  mixins: [blockForm],
  data() {
    return { putAside: null }; // the other source's list, back if the author switches back
  },
  computed: {
    fromAnswers() {
      return "optionsFrom" in this.block;
    },
  },
  methods: {
    swap(from, to, fallback) {
      const kept = this.putAside;
      this.putAside = this.block[from];
      this.edit((block) => {
        delete block[from];
        block[to] = kept || fallback();
      }, true);
    },
    useFixed() {
      this.swap("optionsFrom", "options", () => [
        { id: "o1", label: "Option 1" },
      ]);
    },
    useAnswers() {
      this.swap("options", "optionsFrom", () => []);
    },
  },
};
</script>
