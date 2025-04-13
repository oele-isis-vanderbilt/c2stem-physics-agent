<template>
  <div class="container">
    <build-env></build-env>
  </div>
</template>

<script>
import BuildEnv from "@/components/BuildEnv.vue";

export default {
  name: "HomeView",
  components: {
    BuildEnv,
  },
};
</script>

<style>
.container {
  max-width: 100%;
  height: 100%;
  padding: 0;
  background-color: #1e1e1e;
  position: relative;
}
</style>
