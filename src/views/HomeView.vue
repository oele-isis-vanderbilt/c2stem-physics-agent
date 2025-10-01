<template>
  <div class="container">
    <!--    <build-env></build-env>-->
    <lesson-card
      :lessonNames="names"
      :description="description"
      :route="route"
      :engineering="engineering"
    ></lesson-card>
  </div>
</template>

<script>
import LessonCard from "../components/LessonCard.vue";
// import BuildEnv from "@/components/BuildEnv.vue";

export default {
  name: "HomeView",
  components: {
    // BuildEnv,
    LessonCard,
  },
  data() {
    return {
      names: ["Sloth Task"],
      description: ["Complete your computational model lessons"],
      route: ["Construct"],
      engineering: true,
    };
  },
};
</script>

<style>
.container {
  max-width: 100%;
  height: 80%;
}
</style>
