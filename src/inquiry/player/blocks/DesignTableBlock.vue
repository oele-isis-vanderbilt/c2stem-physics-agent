<template>
  <div class="design-table">
    <div v-if="block.title" class="text-center mb-1">{{ title }}</div>
    <p v-if="block.prompt" class="text-center mb-2">{{ prompt }}</p>
    <static-table :table="{ rows: block.rows || [], trials: block.trials }" />
  </div>
</template>

<script>
import { fillRefs } from "../lesson";
import blockProps from "./blockProps";
import StaticTable from "./StaticTable.vue";

/** Read-only design table. The editable one comes with fill-in-the-blanks. */
export default {
  name: "DesignTableBlock",
  components: { StaticTable },
  props: blockProps,
  computed: {
    title() {
      return fillRefs(this.block.title, this.ctx);
    },
    prompt() {
      return fillRefs(this.block.prompt, this.ctx);
    },
  },
};
</script>

<style scoped>
.design-table {
  border: 2px solid var(--inq-soft-border, #cfc9df);
  border-radius: 8px;
  padding: 16px;
}
</style>
