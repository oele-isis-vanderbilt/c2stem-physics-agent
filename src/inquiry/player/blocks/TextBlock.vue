<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized in renderMarkdown -->
  <div class="inquiry-md" v-html="html"></div>
</template>

<script>
import { fillRefs } from "../lesson";
import { escapeMarkdown, renderMarkdown } from "../markdown";
import blockProps from "./blockProps";

export default {
  name: "TextBlock",
  props: blockProps,
  computed: {
    html() {
      return renderMarkdown(fillRefs(this.block.md, this.ctx, escapeMarkdown));
    },
  },
};
</script>

<style>
.inquiry-md > :last-child {
  margin-bottom: 0;
}
</style>
