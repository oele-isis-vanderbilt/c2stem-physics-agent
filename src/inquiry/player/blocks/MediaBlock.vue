<template>
  <div class="media-row">
    <figure v-for="(item, i) in block.items" :key="i" class="media-item">
      <template v-if="srcOf(item) && !failed[srcOf(item)]">
        <video
          v-if="item.kind === 'video'"
          :src="srcOf(item)"
          :aria-label="item.alt"
          controls
          @error="failed[srcOf(item)] = true"
        ></video>
        <img
          v-else
          :src="srcOf(item)"
          :alt="item.alt"
          @error="failed[srcOf(item)] = true"
        />
      </template>
      <!-- Missing or not yet uploaded: show what it would have shown -->
      <div v-else class="media-missing">{{ item.alt }}</div>
      <figcaption v-if="item.caption">{{ item.caption }}</figcaption>
    </figure>
  </div>
</template>

<script>
import blockProps from "./blockProps";
import { mediaSrc } from "../../connection";

export default {
  name: "MediaBlock",
  props: blockProps,
  data() {
    return { failed: {} }; // by address, so a changed address is tried afresh
  },
  methods: {
    srcOf: mediaSrc,
  },
};
</script>

<style scoped>
.media-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}
.media-item {
  flex: 1 1 240px;
  max-width: 560px;
  margin: 0;
  text-align: center;
}
.media-item img,
.media-item video {
  max-width: 100%;
  border: 3px solid var(--inq-purple, #615195);
  border-radius: 8px;
}
.media-missing {
  border: 2px dashed #b6b0c8;
  border-radius: 8px;
  padding: 32px 16px;
  color: var(--inq-muted, #5c5670);
  font-style: italic;
}
figcaption {
  margin-top: 6px;
  font-size: 0.875rem;
}
</style>
