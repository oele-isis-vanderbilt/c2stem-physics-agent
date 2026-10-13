<template>
  <table class="table table-sm static-table mb-0">
    <thead>
      <tr>
        <th scope="col">Variable</th>
        <th v-for="trial in trials" :key="trial" scope="col">
          Trial {{ trial }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in table.rows" :key="row.label">
        <th scope="row">{{ row.label }}</th>
        <td v-for="trial in trials" :key="trial">{{ row.values[trial] }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script>
/** Variable / Trial A / Trial B table, shared by choice cards and design tables. */
export default {
  name: "StaticTable",
  props: {
    table: { type: Object, required: true }, // { rows, trials? }
  },
  computed: {
    trials() {
      return this.table.trials || ["A", "B"];
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
