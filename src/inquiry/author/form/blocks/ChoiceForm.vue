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
    <options-editor
      :options="options"
      :min="2"
      :invalid="(path) => invalid(`options/${path}`)"
      @edit="(fn, b) => editInto('options', fn, b)"
    >
      <template #tools="{ option, index }">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary card-toggle"
          :aria-expanded="isOpen(option, index) ? 'true' : 'false'"
          :title="
            isCard(option)
              ? 'This option shows as a card'
              : 'Add a description or table'
          "
          @click="toggle(index)"
        >
          Card {{ isOpen(option, index) ? "▾" : "▸" }}
        </button>
      </template>
      <template #details="{ option, index }">
        <div v-if="isOpen(option, index)" class="option-card">
          <text-field
            label="Card text"
            multiline
            :rows="2"
            :model-value="option.prompt || ''"
            :invalid="invalid(`options/${index}/prompt`)"
            hint="Shown under the option's label."
            @update:model-value="(v) => setOption(index, 'prompt', v)"
          />
          <div class="field">
            <div class="field-label">
              <span>Table</span>
              <button
                v-if="option.table"
                type="button"
                class="btn btn-sm btn-link add-link"
                @click="setOption(index, 'table', null, true)"
              >
                Remove table
              </button>
            </div>
            <static-table-editor
              v-if="option.table"
              :table="option.table"
              :invalid="(path) => invalid(`options/${index}/table/${path}`)"
              @edit="
                (fn, boundary) =>
                  editOption(index, (o) => fn(o.table), boundary)
              "
            />
            <button
              v-else
              type="button"
              class="btn btn-sm btn-link add-link"
              @click="addTable(index)"
            >
              + Add a table
            </button>
          </div>
        </div>
      </template>
    </options-editor>
    <p class="field-hint">
      Options with card text or a table show as cards side by side.
    </p>
  </div>
</template>

<script>
import OptionsEditor from "../fields/OptionsEditor.vue";
import StaticTableEditor from "../fields/StaticTableEditor.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

/** Choice: question and options; an option can be a card with text and a table. */
export default {
  name: "ChoiceForm",
  components: { OptionsEditor, StaticTableEditor, TextField },
  mixins: [blockForm],
  data() {
    return { opened: {} }; // option index -> open or closed by the author
  },
  computed: {
    options() {
      return Array.isArray(this.block.options) ? this.block.options : [];
    },
  },
  methods: {
    isCard(option) {
      return !!(option.prompt || option.table);
    },
    isOpen(option, index) {
      return this.opened[index] ?? this.isCard(option);
    },
    toggle(index) {
      this.opened = {
        ...this.opened,
        [index]: !this.isOpen(this.options[index], index),
      };
    },
    editOption(index, fn, boundary) {
      this.edit((block) => fn(block.options[index]), boundary);
    },
    setOption(index, field, value, boundary = false) {
      this.editOption(
        index,
        (option) => {
          if (value === "" || value === null) delete option[field];
          else option[field] = value;
        },
        boundary
      );
    },
    addTable(index) {
      this.editOption(
        index,
        (option) => {
          option.table = { rows: [{ label: "", values: { A: "", B: "" } }] };
        },
        true
      );
    },
  },
};
</script>
