<template>
  <div class="container">
    <!--    <build-env></build-env>-->
    <lesson-card
      :lessonNames="names"
      :description="description"
      :route="route"
      :logo="logo"
      :routeParams="routeParams"
    ></lesson-card>
  </div>
</template>

<script>
import LessonCard from "../components/LessonCard.vue";
// import BuildEnv from "@/components/BuildEnv.vue";
// import slothLogo from "@/assets/sloth.png";
import c2stemTruckLogo from "@/assets/c2stem_truck.png";
// import droneLogo from "@/assets/drone.png";
// import farmTruckLogo from "@/assets/farm.png";

export default {
  name: "HomeView",
  components: {
    // BuildEnv,
    LessonCard,
  },
  data() {
    return {
      names: ["Truck: Problem Solving", "Truck: Debug"],
      description: ["Complete your computational model lessons", ""],
      route: ["ConstructAgent", "ConstructAgent"],
      logo: [c2stemTruckLogo, c2stemTruckLogo],
      routeParams: [
        {
          userID: "oele",
          projectName: "Truck_Model_full_empty_HIDDEN_BLOCKS",
          source: "https://physics.c2stem.org",
        },
        {
          userID: "oele",
          projectName: "Truck_Model_debug_HIDDEN_BLOCKS",
          source: "https://physics.c2stem.org",
        },
      ],
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
