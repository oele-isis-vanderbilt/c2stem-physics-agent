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
        <p v-if="item.mediaId" class="field-hint">
          Uploaded file {{ item.mediaId }}.
        </p>
        <text-field
          v-else
          label="Web address (URL)"
          :model-value="item.url || ''"
          :invalid="invalid(`items/${i}/url`) || invalid(`items/${i}`)"
          placeholder="https://…"
          hint="Uploading files comes in a later update."
          @update:model-value="(v) => setItem(i, 'url', v)"
        />
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
import RowTools from "../fields/RowTools.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";

/** Media: up to 4 pictures, GIFs or videos, each with alt text and a caption. */
export default {
  name: "MediaForm",
  components: { RowTools, TextField },
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
