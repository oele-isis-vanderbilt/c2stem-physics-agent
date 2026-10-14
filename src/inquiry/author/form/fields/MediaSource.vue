<template>
  <div class="field media-source">
    <div class="field-label"><span>File</span></div>

    <div class="media-preview" :class="{ 'is-invalid': invalid }">
      <template v-if="src && !broken">
        <video
          v-if="item.kind === 'video'"
          :src="src"
          muted
          controls
          preload="metadata"
          @error="broken = true"
        ></video>
        <img v-else :src="src" alt="" @error="broken = true" />
      </template>
      <span v-else-if="src" class="text-danger">
        This file couldn't be shown. Check the address, or upload it.
      </span>
      <span v-else class="text-muted">No file yet</span>
    </div>
    <p v-if="item.mediaId" class="field-hint">
      Uploaded file{{ uploadedName ? `: ${uploadedName}` : "" }}
    </p>

    <div class="media-actions">
      <label
        class="btn btn-sm btn-purple mb-0"
        :class="{ disabled: uploading }"
      >
        {{
          uploading
            ? "Uploading…"
            : item.mediaId
            ? "Upload another file"
            : "Upload a file"
        }}
        <input
          ref="file"
          type="file"
          class="visually-hidden"
          :accept="ACCEPT"
          :disabled="uploading"
          @change="upload($event.target.files[0])"
        />
      </label>
      <button
        type="button"
        class="btn btn-sm btn-outline-purple"
        :aria-expanded="choosing ? 'true' : 'false'"
        @click="choosing = !choosing"
      >
        {{ choosing ? "Close uploaded files" : "Choose an uploaded file" }}
      </button>
    </div>
    <div
      v-if="uploading"
      class="progress mt-2"
      role="progressbar"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Upload progress"
    >
      <div class="progress-bar" :style="{ width: `${progress * 100}%` }"></div>
    </div>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
    <p class="field-hint">
      PNG, JPEG, WebP or GIF up to 10 MB; MP4 or WebM video up to 100 MB.
    </p>

    <media-library
      v-if="choosing"
      :kind="item.kind"
      :selected="item.mediaId || ''"
      @pick="choose"
    />

    <text-field
      v-if="!item.mediaId"
      label="Or a web address (URL)"
      :model-value="item.url || ''"
      :invalid="invalid"
      placeholder="https://…"
      @update:model-value="(v) => $emit('url', v)"
    />
    <button
      v-else
      type="button"
      class="btn btn-sm btn-link add-link"
      @click="$emit('url', '')"
    >
      Use a web address instead
    </button>
  </div>
</template>

<script>
import MediaLibrary from "./MediaLibrary.vue";
import TextField from "./TextField.vue";
import { inquiryApi, mediaSrc } from "../../../connection";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm";

function detailOf(error) {
  const detail =
    error.response && error.response.data && error.response.data.detail;
  return typeof detail === "string" ? detail : null;
}

/**
 * Where one media item's file comes from: an upload, a file uploaded
 * before, or a web address. Shows what it will look like.
 * Emits pick({ mediaId, kind, filename }) and url(text).
 */
export default {
  name: "MediaSource",
  components: { MediaLibrary, TextField },
  props: {
    item: { type: Object, required: true },
    invalid: { type: Boolean, default: false },
  },
  emits: ["pick", "url"],
  data() {
    return {
      ACCEPT,
      uploading: false,
      progress: 0,
      error: null,
      choosing: false,
      broken: false,
      names: {}, // mediaId -> filename, for files picked or uploaded here
    };
  },
  computed: {
    src() {
      return mediaSrc(this.item);
    },
    uploadedName() {
      return this.names[this.item.mediaId] || "";
    },
  },
  watch: {
    src() {
      this.broken = false;
    },
  },
  methods: {
    async upload(file) {
      if (!file) return;
      this.uploading = true;
      this.progress = 0;
      this.error = null;
      try {
        const media = await inquiryApi().uploadMedia(
          file,
          (p) => (this.progress = p)
        );
        this.choose(media);
      } catch (e) {
        const code = e.response && e.response.status;
        this.error =
          detailOf(e) ||
          (code === 413
            ? "That file is too big."
            : "Couldn't upload the file. Check your connection and try again.");
      } finally {
        this.uploading = false;
        this.$refs.file.value = ""; // the same file can be picked again
      }
    },
    choose(media) {
      this.names = { ...this.names, [media.id]: media.filename };
      this.choosing = false;
      this.error = null;
      this.$emit("pick", {
        mediaId: media.id,
        kind: media.kind,
        filename: media.filename,
      });
    },
  },
};
</script>
