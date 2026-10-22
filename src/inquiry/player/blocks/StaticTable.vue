<template>
  <table class="table table-sm static-table mb-0">
    <thead>
      <tr>
        <th v-for="(header, i) in headers" :key="i" scope="col">
          {{ header }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, r) in table.rows" :key="r">
        <th scope="row">{{ row.label }}</th>
        <td v-for="trial in trials" :key="trial">{{ row.values[trial] }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script>
import { headersOf, trialsOf } from "../lesson";

/** A read-only table with typed headings, shared by choice cards and design tables. */
export default {
  name: "StaticTable",
  props: {
    table: { type: Object, required: true }, // { rows, trials?, headers? }
  },
  computed: {
    trials() {
      return trialsOf(this.table);
    },
    headers() {
      return headersOf(this.table);
    },
  },
};
</script>

<style scoped>
.static-table {
  text-align: center;
  font-size: 14px;
}
.static-table thead th {
  background: var(--inq-ink, #2e2645);
  color: #fff;
  padding: 8px;
}
.static-table tbody th,
.static-table tbody td {
  background: var(--inq-row2, #f5f3fa);
  font-weight: normal;
  padding: 8px;
}
.static-table tbody tr:nth-child(odd) th,
.static-table tbody tr:nth-child(odd) td {
  background: var(--inq-row1, #e9e5f2);
}
</style>
