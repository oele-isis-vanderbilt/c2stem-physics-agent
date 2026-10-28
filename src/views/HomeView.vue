<template>
  <div class="container">
    <!--    <build-env></build-env>-->
    <lesson-card
      :lessonNames="names"
      :description="description"
      :route="route"
      :logo="logo"
      :routeParams="routeParams"
      :routeQueries="routeQueries"
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
import inquiryLogo from "@/assets/a-magnifier-graph.png";
import pushcartLogo from "@/assets/c2stem_pushcart.png";
import springmassLogo from "@/assets/c2stem_springmass.png";

export default {
  name: "HomeView",
  components: {
    // BuildEnv,
    LessonCard,
  },
  created() {
    if (this.$store.state.role === "admin") {
      this.names.push("Inquiry Authoring");
      this.description.push("Create, preview and publish inquiry lessons");
      this.route.push("InquiryAuthorHome");
      this.logo.push(null);
      this.routeParams.push({});
      this.routeQueries.push({});
    }
  },
  data() {
    return {
      names: [
        "Truck: Problem Solving",
        "Inquiry",
        "Push cart: Problem Solving",
        "Spring-mass: Problem Solving",
      ],
      description: [
        "Complete your computational model lessons",
        "Scientific inquiry lessons",
        "Complete your computational model lessons",
        "Complete your computational model lessons",
      ],
      route: [
        "ConstructAgent",
        "InquiryHome",
        "ConstructAgent",
        "ConstructAgent",
      ],
      // lessonId picks the lesson's scoring (services/scoring)
      routeQueries: [
        { lessonId: "truck" },
        {},
        { lessonId: "lesson1" },
        { lessonId: "lesson2" },
      ],
      // route: ["ConstructAgent", "ConstructAgent", "ConstructAgent"],
      logo: [c2stemTruckLogo, inquiryLogo, pushcartLogo, springmassLogo],
      // logo: [c2stemTruckLogo, droneLogo, droneLogo],
      routeParams: [
        {
          userID: "oele",
          projectName: "Truck_Model_full_empty_HIDDEN_BLOCKS",
          source: "https://physics.c2stem.org",
        },
        {},
        {
          userID: "oele",
          projectName: "Pushcart",
          source: "https://physics.c2stem.org",
        },
        {
          userID: "oele",
          projectName: "Springmass",
          source: "https://physics.c2stem.org",
        },
        // {
        //   userID: "oele",
        //   projectName: "Truck_Model_full_empty_HIDDEN_BLOCKS",
        //   source: "https://physics.c2stem.org",
        // },
        // {
        //   userID: "oele",
        //   projectName: "Drone_Model_one_package_empty_HIDDEN_BLOCKS",
        //   source: "https://physics.c2stem.org",
        // },
        // {
        //   userID: "oele",
        //   projectName: "Drone_Model_two_packages_empty_HIDDEN_BLOCKS",
        //   source: "https://physics.c2stem.org",
        // },
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
