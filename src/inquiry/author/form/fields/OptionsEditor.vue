<template>
  <div class="field">
    <div class="field-label">
      <span>{{ label }}</span>
    </div>
    <ol class="list-unstyled item-list">
      <li v-for="(option, i) in list" :key="i" class="item-row-wrap">
        <div class="item-row">
          <input
            type="text"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': invalid(`${i}/label`) }"
            :aria-label="`Option ${i + 1}`"
            :value="option.label"
            @input="setLabel(i, $event.target.value)"
          />
          <slot name="tools" :option="option" :index="i"></slot>
          <row-tools
            :index="i"
            :count="list.length"
            :can-remove="list.length > min"
            :what="`option ${i + 1}`"
            @move="(dir) => move(i, dir)"
            @remove="removeAt(i)"
          />
        </div>
        <slot name="details" :option="option" :index="i"></slot>
      </li>
    </ol>
    <button type="button" class="btn btn-sm btn-link add-link" @click="add">
      + Add option
    </button>
  </div>
</template>

<script>
import RowTools from "./RowTools.vue";

/** Fixed options { id, label }. New ones get the next free id o1, o2, … */
export default {
  name: "OptionsEditor",
  components: { RowTools },
  props: {
    options: { type: Array, default: () => [] },
    label: { type: String, default: "Options" },
    min: { type: Number, default: 1 },
    invalid: { type: Function, default: () => false }, // path inside the list
  },
  emits: ["edit"],
  computed: {
    list() {
      return this.options.filter((o) => o && typeof o === "object");
    },
  },
  methods: {
    edit(fn, boundary = true) {
      this.$emit("edit", fn, boundary);
    },
    setLabel(i, label) {
      this.edit((options) => {
        options[i].label = label;
      }, false);
    },
    move(i, dir) {
      this.edit((options) => {
        const [option] = options.splice(i, 1);
        options.splice(i + dir, 0, option);
      });
    },
    removeAt(i) {
      this.edit((options) => options.splice(i, 1));
    },
    add() {
      const ids = new Set(this.list.map((o) => o.id));
      let n = 1;
      while (ids.has(`o${n}`)) n += 1;
      this.edit((options) => {
        options.push({ id: `o${n}`, label: `Option ${options.length + 1}` });
      });
    },
  },
};
</script>
