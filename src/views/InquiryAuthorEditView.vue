<template>
  <lesson-editor
    ref="editor"
    :key="$route.params.lessonId"
    :lesson-id="$route.params.lessonId"
    @list="$router.push({ name: 'InquiryAuthorHome' })"
  />
</template>

<script>
import LessonEditor from "@/inquiry/author/LessonEditor.vue";

export default {
  name: "InquiryAuthorEditView",
  components: { LessonEditor },
  beforeRouteLeave(to, from, next) {
    const editor = this.$refs.editor;
    if (
      editor &&
      editor.dirty &&
      !window.confirm("You have unsaved changes. Leave without saving?")
    ) {
      next(false);
    } else {
      next();
    }
  },
};
</script>
