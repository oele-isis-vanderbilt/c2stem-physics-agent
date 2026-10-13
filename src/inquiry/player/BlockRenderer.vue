<template>
  <component
    :is="component"
    v-if="shown"
    class="block"
    :block="block"
    :value="ctx.answers[block.id]"
    :ctx="ctx"
    :read-only="readOnly"
    @answer="answer"
    @leave="leave"
  />
</template>

<script>
import ChoiceBlock from "./blocks/ChoiceBlock.vue";
import ComingSoonBlock from "./blocks/ComingSoonBlock.vue";
import DesignTableBlock from "./blocks/DesignTableBlock.vue";
import FeedbackBlock from "./blocks/FeedbackBlock.vue";
import FreeTextBlock from "./blocks/FreeTextBlock.vue";
import MediaBlock from "./blocks/MediaBlock.vue";
import SelectBlock from "./blocks/SelectBlock.vue";
import TextBlock from "./blocks/TextBlock.vue";
import { isNotBuilt, isShown } from "./lesson";

const COMPONENTS = {
  text: TextBlock,
  media: MediaBlock,
  freeText: FreeTextBlock,
  choice: ChoiceBlock,
  select: SelectBlock,
  designTable: DesignTableBlock,
  feedback: FeedbackBlock,
};

/**
 * Shows one block and saves its answers. Every block gets the same props:
 * block, value, ctx and readOnly; answerable ones emit answer(value, typing)
 * and leave (the student moved out of a text box).
 */
export default {
  name: "BlockRenderer",
  props: {
    block: { type: Object, required: true },
    ctx: { type: Object, required: true },
    readOnly: { type: Boolean, default: false },
  },
  computed: {
    shown() {
      return isShown(this.block, this.ctx);
    },
    component() {
      if (isNotBuilt(this.block)) return ComingSoonBlock;
      return COMPONENTS[this.block.type] || ComingSoonBlock;
    },
  },
  methods: {
    answer(value, typing = false) {
      this.$store.dispatch("inquiry/setAnswer", {
        blockId: this.block.id,
        value,
        typing,
      });
    },
    leave() {
      this.$store.dispatch("inquiry/flush");
    },
  },
};
</script>

<style scoped>
.block + .block {
  margin-top: 1.25rem;
}
</style>
