<template>
  <student-progress
    :initial-lesson="$route.query.lessonId || ''"
    @back="$router.push({ name: 'InquiryAuthorHome' })"
  />
</template>

<script>
import StudentProgress from "@/inquiry/author/StudentProgress.vue";

export default {
  name: "InquiryProgressView",
  components: { StudentProgress },
};
</script>
