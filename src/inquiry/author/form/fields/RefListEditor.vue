<template>
  <div class="field">
    <div class="field-label">
      <span>{{ label }}</span>
    </div>
    <p v-if="!list.length" class="field-hint">
      None picked yet. Students see their answers to the ones you pick, in this
      order.
    </p>
    <ol class="list-unstyled item-list">
      <li v-for="(ref, i) in list" :key="ref + i" class="item-row">
        <span
          class="ref-name"
          :class="{ 'is-invalid': !labelOf(ref) || invalid(`${i}`) }"
        >
          {{ labelOf(ref) || `${ref} (not an earlier answer)` }}
        </span>
        <row-tools
          :index="i"
          :count="list.length"
          :what="ref"
          @move="(dir) => move(i, dir)"
          @remove="removeAt(i)"
        />
      </li>
    </ol>
    <select
      v-if="unpicked.length"
      class="form-select form-select-sm add-ref"
      :aria-label="`Add to ${label}`"
      value=""
      @change="add($event)"
    >
      <option value="" disabled>+ Add an earlier answer…</option>
      <option v-for="a in unpicked" :key="a.ref" :value="a.ref">
        {{ a.label }}
      </option>
    </select>
    <p v-else-if="!answers.length" class="field-hint">
      There are no named answers before this block.
    </p>
  </div>
</template>

<script>
import RowTools from "./RowTools.vue";

/** An ordered list of earlier answers (refs), e.g. a dropdown's optionsFrom. */
export default {
  name: "RefListEditor",
  components: { RowTools },
  props: {
    refs: { type: Array, default: () => [] },
    answers: { type: Array, default: () => [] },
    label: { type: String, default: "Answers" },
    invalid: { type: Function, default: () => false },
  },
  emits: ["edit"],
  computed: {
    list() {
      return this.refs.filter((r) => typeof r === "string");
    },
    unpicked() {
      return this.answers.filter((a) => !this.list.includes(a.ref));
    },
  },
  methods: {
    labelOf(ref) {
      const answer = this.answers.find((a) => a.ref === ref);
      return answer && answer.label;
    },
    edit(fn) {
      this.$emit("edit", fn, true);
    },
    move(i, dir) {
      this.edit((refs) => {
        const [ref] = refs.splice(i, 1);
        refs.splice(i + dir, 0, ref);
      });
    },
    removeAt(i) {
      this.edit((refs) => refs.splice(i, 1));
    },
    add(event) {
      const ref = event.target.value;
      event.target.value = "";
      this.edit((refs) => refs.push(ref));
    },
  },
};
</script>
