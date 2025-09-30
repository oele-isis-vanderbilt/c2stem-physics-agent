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
      names: ["Task 1", "Task 2"],
      description: [
        "Complete your computational model lessons",
        "Explore the agent",
      ],
      route: ["Construct", "ConstructAgent"],
      engineering: true,
    };
  },
};
</script>

<!--<style>-->
<!--.container {-->
<!--  max-width: 100%;-->
<!--  height: 100%;-->
<!--  padding: 0;-->
<!--  //background-color: #1e1e1e;-->
<!--  position: relative;-->
<!--}-->
<!--</style>-->
