<template>
  <div class="container">
    <!--    <build-env></build-env>-->
    <lesson-card
      :lessonNames="names"
      :description="description"
      :route="route"
      :logo="logo"
    ></lesson-card>
  </div>
</template>

<script>
import LessonCard from "../components/LessonCard.vue";
// import BuildEnv from "@/components/BuildEnv.vue";
import slothLogo from "@/assets/sloth.png";
import c2stemTruckLogo from "@/assets/c2stem_med_truck.png";

export default {
  name: "HomeView",
  components: {
    // BuildEnv,
    LessonCard,
  },
  data() {
    return {
      names: ["Sloth Task", "Truck Task"],
      description: ["Complete your computational model lessons", ""],
      route: ["Construct", "ConstructAgent"],
      logo: [slothLogo, c2stemTruckLogo],
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
