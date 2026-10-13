<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized in renderMarkdown -->
  <div :class="['feedback', toneClass, 'inquiry-md']" v-html="html"></div>
</template>

<script>
import { fillRefs } from "../lesson";
import { escapeMarkdown, renderMarkdown } from "../markdown";
import blockProps from "./blockProps";

const TONES = {
  info: "feedback-info",
  success: "alert alert-success mb-0",
  warning: "alert alert-warning mb-0",
};

export default {
  name: "FeedbackBlock",
  props: blockProps,
  computed: {
    toneClass() {
      return TONES[this.block.tone] || TONES.info;
    },
    html() {
      return renderMarkdown(fillRefs(this.block.md, this.ctx, escapeMarkdown));
    },
  },
};
</script>

<style scoped>
.feedback-info {
  background: var(--inq-tint, #f4f2f9);
  border-left: 4px solid var(--inq-purple, #615195);
  border-radius: 4px;
  padding: 14px 18px;
}
</style>
