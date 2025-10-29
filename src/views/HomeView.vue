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
// import slothLogo from "@/assets/sloth.png";
import c2stemTruckLogo from "@/assets/c2stem_truck.png";
import droneLogo from "@/assets/drone.png";
// import farmTruckLogo from "@/assets/farm.png";

export default {
  name: "HomeView",
  components: {
    // BuildEnv,
    LessonCard,
  },
  data() {
    return {
      names: ["Truck Task: Problem Solving", "Drone Task: Problem Solving"],
      description: ["Complete your computational model lessons", ""],
      route: ["Construct", "ConstructAgent"],
      logo: [c2stemTruckLogo, droneLogo],
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
