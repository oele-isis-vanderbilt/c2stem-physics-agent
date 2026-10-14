<template>
  <div class="media-library">
    <div class="library-filter" role="group" aria-label="Show">
      <button
        v-for="f in filters"
        :key="f.id"
        type="button"
        class="btn btn-sm"
        :class="filter === f.id ? 'btn-purple' : 'btn-outline-purple'"
        :aria-pressed="filter === f.id ? 'true' : 'false'"
        @click="filter = f.id"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="status === 'loading'" class="field-hint">
      Loading uploaded files…
    </p>
    <p v-else-if="status === 'error'" class="field-error">
      Couldn't load the uploaded files.
      <button type="button" class="btn btn-sm btn-link p-0" @click="load">
        Try again
      </button>
    </p>
    <p v-else-if="!shown.length" class="field-hint">
      {{
        files.length
          ? "Nothing of this kind uploaded yet."
          : "Nothing uploaded yet."
      }}
    </p>
    <ul v-else class="list-unstyled library-grid">
      <li v-for="file in shown" :key="file.id">
        <button
          type="button"
          class="library-file"
          :class="{ selected: file.id === selected }"
          :aria-pressed="file.id === selected ? 'true' : 'false'"
          @click="$emit('pick', file)"
        >
          <video
            v-if="file.kind === 'video'"
            :src="urlOf(file)"
            muted
            preload="metadata"
            aria-hidden="true"
          ></video>
          <img v-else :src="urlOf(file)" alt="" loading="lazy" />
          <span class="library-name">{{ file.filename }}</span>
          <span class="library-meta">
            {{ kindLabel(file.kind) }} · {{ sizeOf(file.size) }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
import { inquiryApi } from "../../../connection";

const KIND_LABELS = { image: "Picture", gif: "GIF", video: "Video" };

/**
 * Files uploaded before, newest first, to use again. Opens on the kind
 * the item has. Emits pick(file).
 */
export default {
  name: "MediaLibrary",
  props: {
    kind: { type: String, default: "" },
    selected: { type: String, default: "" },
  },
  emits: ["pick"],
  data() {
    return {
      files: [],
      status: "loading",
      filter: this.kind || "all",
      filters: [
        { id: "all", label: "All" },
        { id: "image", label: "Pictures" },
        { id: "gif", label: "GIFs" },
        { id: "video", label: "Videos" },
      ],
    };
  },
  computed: {
    shown() {
      return this.filter === "all"
        ? this.files
        : this.files.filter((f) => f.kind === this.filter);
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      this.status = "loading";
      try {
        this.files = await inquiryApi().media();
        this.status = "ready";
      } catch (e) {
        this.status = "error";
      }
    },
    urlOf(file) {
      return inquiryApi().mediaUrl(file.id);
    },
    kindLabel(kind) {
      return KIND_LABELS[kind] || kind;
    },
    sizeOf(bytes) {
      if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    },
  },
};
</script>
