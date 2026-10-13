<template>
  <div class="coming-soon">
    {{ label }} goes here. It isn't built yet, so it doesn't stop you from
    continuing.
  </div>
</template>

<script>
import blockProps from "./blockProps";

const LABELS = {
  fillInBlanks: "A fill-in-the-blanks question",
  designTable: "An experiment design table",
  select: "A dropdown of your earlier answers",
  simulation: "The simulation",
};

/** Stands in for block types the player doesn't show yet. */
export default {
  name: "ComingSoonBlock",
  props: blockProps,
  computed: {
    label() {
      return LABELS[this.block.type] || `A ${this.block.type} block`;
    },
  },
};
</script>

<style scoped>
.coming-soon {
  border: 2px dashed #b6b0c8;
  border-radius: 8px;
  padding: 16px;
  color: var(--inq-muted, #5c5670);
  font-style: italic;
  text-align: center;
}
</style>
