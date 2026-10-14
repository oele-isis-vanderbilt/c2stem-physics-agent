<template>
  <div>
    <ol class="list-unstyled media-items">
      <li v-for="(item, i) in items" :key="i" class="media-item">
        <div class="media-item-head">
          <strong>Item {{ i + 1 }}</strong>
          <row-tools
            :index="i"
            :count="items.length"
            :can-remove="items.length > 1"
            :what="`item ${i + 1}`"
            @move="(dir) => moveItem(i, dir)"
            @remove="removeItem(i)"
          />
        </div>
        <media-source
          :item="item"
          :invalid="invalid(`items/${i}/url`) || invalid(`items/${i}`)"
          @pick="(file) => pickFile(i, file)"
          @url="(text) => setUrl(i, text)"
        />
        <div class="field field-narrow">
          <div class="field-label">
            <label :for="`kind-${block.id}-${i}`">Kind</label>
          </div>
          <select
            :id="`kind-${block.id}-${i}`"
            class="form-select"
            :class="{ 'is-invalid': invalid(`items/${i}/kind`) }"
            :value="item.kind"
            @change="setItem(i, 'kind', $event.target.value, true)"
          >
            <option value="image">Picture</option>
            <option value="gif">Animated GIF</option>
            <option value="video">Video</option>
          </select>
        </div>
        <text-field
          label="Description for screen readers (alt text)"
          :model-value="item.alt || ''"
          :invalid="invalid(`items/${i}/alt`)"
          hint="What the picture shows, for students who can't see it."
          @update:model-value="(v) => setItem(i, 'alt', v, false, true)"
        />
        <text-field
          label="Caption"
          :model-value="item.caption || ''"
          :invalid="invalid(`items/${i}/caption`)"
          @update:model-value="(v) => setItem(i, 'caption', v)"
        />
      </li>
    </ol>
    <button
      v-if="items.length < 4"
      type="button"
      class="btn btn-sm btn-link add-link"
      @click="addItem"
    >
      + Add item
    </button>
    <p v-else class="field-hint">A media block holds up to 4 items.</p>
  </div>
</template>

<script>
import MediaSource from "../fields/MediaSource.vue";
import RowTools from "../fields/RowTools.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

/**
 * Media: up to 4 pictures, GIFs or videos, each uploaded, chosen from
 * earlier uploads or given by web address, with alt text and a caption.
 */
export default {
  name: "MediaForm",
  components: { MediaSource, RowTools, TextField },
  mixins: [blockForm],
  computed: {
    items() {
      return (Array.isArray(this.block.items) ? this.block.items : []).filter(
        (item) => item && typeof item === "object"
      );
    },
  },
  methods: {
    editItems(fn, boundary = true) {
      this.editInto("items", fn, boundary);
    },
    setItem(i, field, value, boundary = false, required = false) {
      this.editItems((items) => {
        if (value === "" && !required) delete items[i][field];
        else items[i][field] = value;
      }, boundary);
    },
    /** An uploaded file replaces any web address, and sets the kind. */
    pickFile(i, file) {
      this.editItems((items) => {
        const item = items[i];
        delete item.url;
        item.mediaId = file.mediaId;
        item.kind = file.kind;
      });
    },
    setUrl(i, text) {
      const switching = !!this.items[i].mediaId;
      this.editItems((items) => {
        delete items[i].mediaId;
        items[i].url = text;
      }, switching);
    },
    moveItem(i, dir) {
      this.editItems((items) => {
        const [item] = items.splice(i, 1);
        items.splice(i + dir, 0, item);
      });
    },
    removeItem(i) {
      this.editItems((items) => items.splice(i, 1));
    },
    addItem() {
      this.editItems((items) =>
        items.push({ kind: "image", url: "", alt: "" })
      );
    },
  },
};
</script>
