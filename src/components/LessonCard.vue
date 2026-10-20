<template>
  <div class="row">
    <div
      v-for="(name, index) in lessonNames"
      :key="index"
      class="cardCol col-6 col-xl-3 col-lg-3"
    >
      <div class="card">
        <div class="card-body">
          <h5 class="card-title">{{ name }}</h5>
          <!--          <p class="card-text">{{ description[index] }}</p>-->
          <p class="card-text">
            <img
              v-if="logo && logo[index]"
              :src="logo[index]"
              alt=""
              width="100"
              height="60"
            />
            <span v-else class="logo-space"></span>
          </p>
          <router-link
            v-if="routeParams"
            :to="{
              name: route[index],
              params: routeParams[index],
              query: routeQueries && routeQueries[index],
            }"
            ><button type="button" class="btn btn-primary">
              Continue
            </button></router-link
          >
          <router-link v-else :to="{ name: route[index] }"
            ><button type="button" class="btn btn-primary">
              Continue
            </button></router-link
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: "Lesson Card",
  props: {
    lessonNames: {
      type: Array,
      requires: true,
    },
    description: {
      type: Array,
      requires: true,
    },
    route: {
      type: Array,
      requires: true,
    },
    routeParams: {
      type: Object,
    },
    // Optional query per card, e.g. { lessonId: "lesson1" }
    routeQueries: {
      type: Array,
      required: false,
    },
    logo: {
      type: Array,
      required: false,
    },
  },
  computed: {
    currentRouteName() {
      return this.$route.name;
    },
  },
};
</script>

<style scoped>
.card {
  margin: 20px;
  width: fit-content;
  min-width: 180px;
  min-height: fit-content;
  border: 3px inset #615195;
}
.logo-space {
  display: inline-block;
  width: 100px;
  height: 60px;
}
.card-text {
  display: flex;
  justify-content: flex-start;
}
div {
  min-height: 127px;
  max-height: 70% !important;
  margin: 0;
}
.row {
  height: fit-content;
  justify-content: center;
}
.cardCol {
  width: fit-content;
}

.card-body {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
