<template>
  <div>
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
          <!-- Played on the block's shared clock -->
          <canvas
            v-else-if="synced.includes(i)"
            :ref="(el) => (canvases[i] = el)"
            role="img"
            :aria-label="item.alt"
          ></canvas>
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
    <div v-if="synced.length" class="media-tools">
      <button
        type="button"
        class="btn btn-sm btn-replay"
        aria-label="Replay the animations together"
        @click="replay"
      >
        ↻ Replay
      </button>
    </div>
  </div>
</template>

<script>
import blockProps from "./blockProps";
import { mediaSrc } from "../../connection";
import { GifClock, loadGif } from "../media/gifSync";

/**
 * Pictures, GIFs and videos side by side. Two or more GIFs in the block play
 * together: they start at the same time, each holds its last frame until the
 * longest is done, then all start again; Replay starts them over. A GIF that
 * can't be read plays on its own as usual. Videos are left to the student.
 */
export default {
  name: "MediaBlock",
  props: blockProps,
  data() {
    return {
      failed: {}, // by address, so a changed address is tried afresh
      synced: [], // indexes of the GIFs on the shared clock
    };
  },
  computed: {
    /** Addresses of the block's GIFs, by item index. */
    gifSources() {
      return this.block.items
        .map((item, i) => ({ i, src: item.kind === "gif" && mediaSrc(item) }))
        .filter((g) => g.src);
    },
    gifKey() {
      return this.gifSources.map((g) => `${g.i}:${g.src}`).join("|");
    },
  },
  watch: {
    gifKey() {
      this.setup();
    },
  },
  created() {
    this.canvases = {};
    this.clock = null;
    this.loading = 0;
  },
  mounted() {
    this.setup();
  },
  beforeUnmount() {
    this.loading += 1;
    if (this.clock) this.clock.stop();
  },
  methods: {
    srcOf: mediaSrc,
    async setup() {
      const run = (this.loading += 1);
      if (this.clock) this.clock.stop();
      this.clock = null;
      this.synced = [];
      if (this.gifSources.length < 2) return;

      const loaded = await Promise.allSettled(
        this.gifSources.map((g) => loadGif(g.src))
      );
      if (run !== this.loading) return; // the items changed meanwhile
      const ready = this.gifSources
        .map((g, n) => ({ ...g, result: loaded[n] }))
        .filter((g) => g.result.status === "fulfilled");
      if (ready.length < 2) return; // nothing to keep in step

      this.synced = ready.map((g) => g.i);
      await this.$nextTick();
      if (run !== this.loading) return;
      const pairs = ready
        .map((g) => ({ canvas: this.canvases[g.i], gif: g.result.value }))
        .filter((p) => p.canvas);
      if (pairs.length < 2) return;
      this.clock = new GifClock(pairs);
      this.clock.start();
    },
    replay() {
      if (this.clock) this.clock.start();
    },
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
.media-item video,
.media-item canvas {
  max-width: 100%;
  border: 3px solid var(--inq-purple, #615195);
  border-radius: 8px;
}
.media-item canvas {
  height: auto;
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
.media-tools {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
.btn-replay {
  border: 1.5px solid var(--inq-purple, #615195);
  color: var(--inq-purple, #615195);
  background: #fff;
}
.btn-replay:hover {
  background: var(--inq-tint, #f4f2f9);
}
</style>
