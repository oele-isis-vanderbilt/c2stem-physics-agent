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
// import c2stemTruckLogo from "@/assets/c2stem_truck.png";
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
      names: ["Drone 2 Package: Problem Solving", "Drone 2 Package: Debug"],
      description: ["Complete your computational model lessons", ""],
      route: ["ConstructAgent", "Construct"],
      logo: [droneLogo, droneLogo],
      routeParams: [
        {
          userID: "oele",
          projectName: "Drone_Model_two_packages_empty_HIDDEN_BLOCKS",
          source: "https://physics.c2stem.org",
        },
        {
          userID: "oele",
          projectName: "Drone_Model_two_packages_debug_HIDDEN_BLOCKS",
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
