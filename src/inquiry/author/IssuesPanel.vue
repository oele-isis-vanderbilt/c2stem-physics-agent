<template>
  <div class="issues">
    <div class="issues-head">
      <span v-if="syntaxError" class="text-danger">JSON syntax error</span>
      <span v-else-if="checking">Checking…</span>
      <span v-else-if="issues === null">Not checked yet</span>
      <span v-else-if="!issues.length" class="text-success">No issues</span>
      <span v-else class="text-danger">
        {{ issues.length }} issue{{ issues.length === 1 ? "" : "s" }}
      </span>
    </div>
    <ul class="list-unstyled mb-0">
      <li v-if="syntaxError">
        <button type="button" class="issue" @click="$emit('pick', syntaxError)">
          <span class="where">Line {{ syntaxError.line }}</span>
          {{ syntaxError.message }}
        </button>
      </li>
      <template v-else>
        <li v-for="(issue, i) in issues || []" :key="i">
          <button type="button" class="issue" @click="$emit('pick', issue)">
            <span class="where">{{ issue.path }}</span>
            {{ issue.message }}
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>

<script>
/** Syntax error or validator issues; clicking one emits pick(issue). */
export default {
  name: "IssuesPanel",
  props: {
    issues: { type: Array, default: null }, // null until first checked
    syntaxError: { type: Object, default: null },
    checking: { type: Boolean, default: false },
  },
  emits: ["pick"],
};
</script>

<style scoped>
.issues {
  height: 100%;
  overflow-y: auto;
  font-size: 14px;
}
.issues-head {
  height: auto; /* App.vue sets height: 100% on every div */
  position: sticky;
  top: 0;
  padding: 6px 10px;
  font-weight: 600;
  background: #fff;
  border-bottom: 1px solid var(--inq-line, #ddd8ea);
}
.issue {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-bottom: 1px solid var(--inq-line, #ddd8ea);
  background: none;
  text-align: left;
  color: var(--inq-ink, #2e2645);
}
.issue:hover,
.issue:focus-visible {
  background: var(--inq-tint, #f4f2f9);
}
.where {
  display: block;
  font-family: SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--inq-muted, #5c5670);
}
</style>
