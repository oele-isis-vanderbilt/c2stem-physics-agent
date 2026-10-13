<template>
  <div class="field">
    <div class="field-label">
      <label :for="id">{{ label }}</label>
      <select
        v-if="refs && refs.length"
        class="form-select form-select-sm insert-ref"
        :aria-label="`Insert an earlier answer into ${label}`"
        value=""
        @change="insert($event)"
      >
        <option value="" disabled>Insert earlier answer…</option>
        <option v-for="a in refs" :key="a.ref" :value="a.ref">
          {{ a.label }}
        </option>
      </select>
    </div>
    <textarea
      v-if="multiline"
      :id="id"
      ref="input"
      class="form-control"
      :class="{ 'is-invalid': invalid }"
      :rows="rows"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
    ></textarea>
    <input
      v-else
      :id="id"
      ref="input"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': invalid }"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <p v-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>

<script>
let count = 0;

/**
 * A labelled text box. Given `refs` (earlier answers), it offers to insert
 * {{ref}} at the cursor, which the player fills with the student's answer.
 */
export default {
  name: "TextField",
  props: {
    label: { type: String, required: true },
    modelValue: { type: String, default: "" },
    multiline: { type: Boolean, default: false },
    rows: { type: Number, default: 3 },
    placeholder: { type: String, default: "" },
    hint: { type: String, default: "" },
    refs: { type: Array, default: null },
    invalid: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    count += 1;
    return { id: `text-field-${count}` };
  },
  methods: {
    insert(event) {
      const ref = event.target.value;
      event.target.value = "";
      const input = this.$refs.input;
      const value = this.modelValue || "";
      const start = input.selectionStart ?? value.length;
      const end = input.selectionEnd ?? value.length;
      const token = `{{${ref}}}`;
      this.$emit(
        "update:modelValue",
        value.slice(0, start) + token + value.slice(end)
      );
      this.$nextTick(() => {
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
      });
    },
  },
};
</script>
