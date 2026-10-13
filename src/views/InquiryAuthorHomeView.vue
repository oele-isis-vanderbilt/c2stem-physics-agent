<template>
  <author-home @open="open" />
</template>

<script>
import AuthorHome from "@/inquiry/author/AuthorHome.vue";

export default {
  name: "InquiryAuthorHomeView",
  components: { AuthorHome },
  methods: {
    open(lessonId) {
      this.$router.push({ name: "InquiryAuthorEdit", params: { lessonId } });
    },
  },
};
</script>
