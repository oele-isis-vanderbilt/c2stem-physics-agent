<template>
  <select
    v-if="globals"
    :id="id"
    class="form-select form-select-sm"
    :class="{ 'is-invalid': invalid || missing }"
    :value="value"
    @change="$emit('pick', $event.target.value, false)"
  >
    <option value="">{{ emptyLabel }}</option>
    <option v-if="missing" :value="value">
      {{ value }} ⚠ not in the project
    </option>
    <option v-for="name in names" :key="name" :value="name">
      {{ name }} ({{ describe(globals[name]) }})
    </option>
  </select>
  <input
    v-else
    :id="id"
    type="text"
    class="form-control form-control-sm"
    :class="{ 'is-invalid': invalid }"
    :value="value"
    placeholder="Project variable name"
    @input="$emit('pick', $event.target.value, true)"
  />
</template>

<script>
import { describeValue } from "./ProjectVariables";

/**
 * Picks one of a project's global variables. Before the project is loaded
 * (`globals` null) the name is typed instead. Emits pick(name, typed).
 */
export default {
  name: "ProjectVariablePicker",
  props: {
    id: { type: String, default: undefined },
    value: { type: String, default: "" },
    globals: { type: Object, default: null },
    lists: { type: Boolean, default: false }, // list variables only, or none
    emptyLabel: { type: String, default: "—" },
    invalid: { type: Boolean, default: false },
  },
  emits: ["pick"],
  computed: {
    names() {
      return (
        Object.keys(this.globals)
          // The current pick stays listed even if it isn't a list right now
          .filter(
            (name) =>
              Array.isArray(this.globals[name]) === this.lists ||
              name === this.value
          )
          .sort((a, b) => a.localeCompare(b))
      );
    },
    missing() {
      return !!this.value && !!this.globals && !(this.value in this.globals);
    },
  },
  methods: {
    describe: describeValue,
  },
};
</script>
