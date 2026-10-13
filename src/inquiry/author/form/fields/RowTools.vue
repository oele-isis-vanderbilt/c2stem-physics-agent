<template>
  <span class="row-tools">
    <button
      type="button"
      class="tool"
      :disabled="index === 0"
      :aria-label="`Move ${what} up`"
      title="Move up"
      @click="$emit('move', -1)"
    >
      ↑
    </button>
    <button
      type="button"
      class="tool"
      :disabled="index === count - 1"
      :aria-label="`Move ${what} down`"
      title="Move down"
      @click="$emit('move', 1)"
    >
      ↓
    </button>
    <button
      type="button"
      class="tool tool-remove"
      :disabled="!canRemove"
      :aria-label="`Remove ${what}`"
      title="Remove"
      @click="$emit('remove')"
    >
      ✕
    </button>
  </span>
</template>

<script>
/** Up, down and remove buttons for one row of a list. */
export default {
  name: "RowTools",
  props: {
    index: { type: Number, required: true },
    count: { type: Number, required: true },
    canRemove: { type: Boolean, default: true },
    what: { type: String, default: "row" },
  },
  emits: ["move", "remove"],
};
</script>
