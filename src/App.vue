<template>
  <class-header></class-header>
  <router-view />
</template>

<script>
import ClassHeader from "./components/ClassHeader.vue";

export default {
  name: "App",
  components: {
    ClassHeader,
  },
};
</script>

<style>
html,
body,
div {
  margin: 0;
  height: 100%;
  max-width: 100%;
}
</style>
