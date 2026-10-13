<template>
  <div>
    <text-field
      label="Question"
      multiline
      :rows="2"
      :model-value="block.prompt || ''"
      :refs="answers"
      :invalid="invalid('prompt')"
      @update:model-value="(v) => set('prompt', v)"
    />

    <div class="field">
      <div class="field-label">
        <label :for="`template-${block.id}`">Sentence</label>
        <button
          type="button"
          class="btn btn-sm btn-outline-purple"
          @click="insertGap"
        >
          + Insert gap
        </button>
      </div>
      <textarea
        :id="`template-${block.id}`"
        ref="template"
        class="form-control"
        :class="{ 'is-invalid': invalid('template') || invalid('blanks') }"
        rows="3"
        :value="block.template || ''"
        @input="setTemplate($event.target.value)"
      ></textarea>
      <p class="field-hint">
        Each [[name]] is a gap. A blank line starts a new paragraph.
      </p>
      <p v-if="pieces.length" class="reads-as">
        <span class="reads-as-label">Reads as:</span>
        <template v-for="(piece, i) in pieces" :key="i">
          <span v-if="piece.blank" class="gap-chip"
            >gap {{ gapNumber(piece.blank) }}</span
          >
          <span v-else>{{ piece.text }}</span>
        </template>
      </p>
    </div>

    <p v-for="lost in lostUses" :key="lost.ref" class="field-error">
      Gap “{{ lost.id }}” is gone from the sentence, but {{ lost.ref }} is used
      in {{ lost.uses }} place{{ lost.uses === 1 ? "" : "s" }}. Undo brings it
      back.
    </p>

    <ol class="list-unstyled blank-list">
      <li v-for="(blank, i) in blanks" :key="blank.id" class="blank-item">
        <div class="blank-head">
          <strong>Gap {{ i + 1 }}</strong>
          <code>{{ block.key ? `${block.key}.${blank.id}` : blank.id }}</code>
        </div>
        <div class="form-check form-check-inline">
          <input
            :id="`typed-${block.id}-${blank.id}`"
            class="form-check-input"
            type="radio"
            :name="`input-${block.id}-${blank.id}`"
            :checked="blank.input !== 'select'"
            @change="setInput(i, 'text')"
          />
          <label
            class="form-check-label"
            :for="`typed-${block.id}-${blank.id}`"
          >
            Typed
          </label>
        </div>
        <div class="form-check form-check-inline">
          <input
            :id="`menu-${block.id}-${blank.id}`"
            class="form-check-input"
            type="radio"
            :name="`input-${block.id}-${blank.id}`"
            :checked="blank.input === 'select'"
            @change="setInput(i, 'select')"
          />
          <label class="form-check-label" :for="`menu-${block.id}-${blank.id}`">
            Dropdown
          </label>
        </div>

        <text-field
          v-if="blank.input !== 'select'"
          label="Hint in the empty gap"
          :model-value="blank.placeholder || ''"
          :invalid="invalid(`blanks/${i}/placeholder`)"
          @update:model-value="(v) => setBlank(i, 'placeholder', v)"
        />
        <template v-else>
          <div class="form-check form-check-inline mt-2">
            <input
              :id="`fixed-${block.id}-${blank.id}`"
              class="form-check-input"
              type="radio"
              :name="`source-${block.id}-${blank.id}`"
              :checked="!('optionsFrom' in blank)"
              @change="setSource(i, 'options')"
            />
            <label
              class="form-check-label"
              :for="`fixed-${block.id}-${blank.id}`"
            >
              A fixed list
            </label>
          </div>
          <div class="form-check form-check-inline">
            <input
              :id="`from-${block.id}-${blank.id}`"
              class="form-check-input"
              type="radio"
              :name="`source-${block.id}-${blank.id}`"
              :checked="'optionsFrom' in blank"
              @change="setSource(i, 'optionsFrom')"
            />
            <label
              class="form-check-label"
              :for="`from-${block.id}-${blank.id}`"
            >
              Earlier answers
            </label>
          </div>
          <ref-list-editor
            v-if="'optionsFrom' in blank"
            label="Earlier answers to offer"
            :refs="blank.optionsFrom || []"
            :answers="answers"
            :invalid="(path) => invalid(`blanks/${i}/optionsFrom/${path}`)"
            @edit="(fn, b) => editList(i, 'optionsFrom', fn, b)"
          />
          <options-editor
            v-else
            :options="blank.options || []"
            :invalid="(path) => invalid(`blanks/${i}/options/${path}`)"
            @edit="(fn, b) => editList(i, 'options', fn, b)"
          />
        </template>
      </li>
    </ol>
  </div>
</template>

<script>
import OptionsEditor from "../fields/OptionsEditor.vue";
import RefListEditor from "../fields/RefListEditor.vue";
import TextField from "../fields/TextField.vue";
import blockForm from "../blockForm";
import { newBlankId, refUses, syncBlanks, templateBlanks } from "../../draft";
import { parseTemplate } from "../../../player/lesson";

const strip = (blank) => {
  const { options, optionsFrom, placeholder, ...rest } = blank;
  return { rest, options, optionsFrom, placeholder };
};

/**
 * Fill in the blanks: a sentence with [[gap]]s, and for each gap typed or
 * a dropdown. The gap list follows the sentence; a gap taken out keeps its
 * settings here in case it comes back.
 */
export default {
  name: "FillInBlanksForm",
  components: { OptionsEditor, RefListEditor, TextField },
  mixins: [blockForm],
  data() {
    // Settings put aside: gaps taken out (by id) and the other kind of a
    // gap (by id:kind), so switching back loses nothing
    return { kept: {} };
  },
  computed: {
    blanks() {
      return (Array.isArray(this.block.blanks) ? this.block.blanks : []).filter(
        (b) => b && typeof b === "object"
      );
    },
    pieces() {
      return parseTemplate(this.block.template || "").flatMap((paragraph, i) =>
        i ? [{ text: " ¶ " }, ...paragraph] : paragraph
      );
    },
    lostUses() {
      if (!this.lesson || !this.block.key) return [];
      const present = templateBlanks(this.block.template);
      return Object.keys(this.kept)
        .filter((id) => !id.includes(":") && !present.includes(id))
        .map((id) => {
          const ref = `${this.block.key}.${id}`;
          return { id, ref, uses: refUses(this.lesson, ref) };
        })
        .filter((lost) => lost.uses);
    },
  },
  methods: {
    gapNumber(id) {
      return this.blanks.findIndex((b) => b.id === id) + 1 || "?";
    },
    setTemplate(template) {
      const kept = { ...this.kept };
      this.edit((block) => {
        block.template = template;
        for (const blank of syncBlanks(block, kept)) kept[blank.id] = blank;
      });
      this.kept = kept;
    },
    insertGap() {
      const area = this.$refs.template;
      const value = this.block.template || "";
      const start = area.selectionStart ?? value.length;
      const end = area.selectionEnd ?? value.length;
      const token = `[[${newBlankId(this.block)}]]`;
      this.setTemplate(value.slice(0, start) + token + value.slice(end));
      this.$nextTick(() => {
        area.focus();
        area.setSelectionRange(start + token.length, start + token.length);
      });
    },
    editBlank(i, fn, boundary = false) {
      this.edit((block) => fn(block.blanks[i]), boundary);
    },
    setBlank(i, field, value) {
      this.editBlank(i, (blank) => {
        if (value === "") delete blank[field];
        else blank[field] = value;
      });
    },
    /** Typed or dropdown. The other kind's settings wait in `kept`. */
    setInput(i, input) {
      const current = this.blanks[i];
      const aside = this.kept[`${current.id}:${input}`];
      this.kept = {
        ...this.kept,
        [`${current.id}:${current.input}`]: strip(current),
      };
      this.editBlank(
        i,
        (blank) => {
          const { rest } = strip(blank);
          Object.keys(blank).forEach((k) => delete blank[k]);
          Object.assign(blank, rest, { input });
          if (input === "text") {
            if (aside && aside.placeholder)
              blank.placeholder = aside.placeholder;
          } else if (aside && aside.optionsFrom) {
            blank.optionsFrom = aside.optionsFrom;
          } else {
            blank.options = (aside && aside.options) || [
              { id: "o1", label: "Option 1" },
              { id: "o2", label: "Option 2" },
            ];
          }
        },
        true
      );
    },
    setSource(i, field) {
      const other = field === "options" ? "optionsFrom" : "options";
      const id = this.blanks[i].id;
      const aside = this.kept[`${id}:${field}`];
      this.kept = { ...this.kept, [`${id}:${other}`]: this.blanks[i][other] };
      this.editBlank(
        i,
        (blank) => {
          delete blank[other];
          blank[field] =
            aside ||
            (field === "options" ? [{ id: "o1", label: "Option 1" }] : []);
        },
        true
      );
    },
    editList(i, field, fn, boundary) {
      this.editBlank(
        i,
        (blank) => {
          if (!Array.isArray(blank[field])) blank[field] = [];
          fn(blank[field]);
        },
        boundary
      );
    },
  },
};
</script>
