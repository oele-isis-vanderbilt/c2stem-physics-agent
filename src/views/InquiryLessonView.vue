<template>
  <div>
    <div v-if="lessonStatus === 'loading'" class="text-center my-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <div v-else-if="lessonStatus === 'error'" class="container my-3">
      <div class="alert alert-warning">
        Couldn't open this lesson.
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary ms-2"
          @click="open"
        >
          Retry
        </button>
        <router-link :to="{ name: 'InquiryHome' }" class="ms-2">
          Back to lessons
        </router-link>
      </div>
    </div>

    <lesson-player
      v-else-if="session"
      @finished="toLessons"
      @exit="toLessons"
    />
  </div>
</template>

<script>
import { mapState } from "vuex";
import LessonPlayer from "@/inquiry/player/LessonPlayer.vue";

export default {
  name: "InquiryLessonView",
  components: { LessonPlayer },
  computed: mapState("inquiry", ["session", "lessonStatus"]),
  mounted() {
    this.open();
  },
  beforeUnmount() {
    this.$store.dispatch("inquiry/closeLesson");
  },
  methods: {
    open() {
      this.$store.dispatch("inquiry/openLesson", this.$route.params.lessonId);
    },
    toLessons() {
      this.$router.push({ name: "InquiryHome" });
    },
  },
};
</script>

<style scoped>
/* App.vue sets height: 100% on every div */
div {
  height: auto;
}
</style>
