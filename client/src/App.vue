<template>
  <router-view />
</template>

<script>
export default {
  name: "App",
  // beforeCreate() {
  //   this.$store.dispatch("initializeStorage");
  // },
};
</script>
<style>
html,
body {
  margin: 0;
  height: 100%;
  max-width: 100%;
}
</style>
