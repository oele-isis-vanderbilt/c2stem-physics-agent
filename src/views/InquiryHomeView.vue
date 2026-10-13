<template>
  <div class="container">
    <h2 class="my-3 text-center">Inquiry</h2>

    <div v-if="catalogStatus === 'loading'" class="text-center my-5">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <div v-else-if="catalogStatus === 'error'" class="alert alert-warning">
      Couldn't load lessons.
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary ms-2"
        @click="load"
      >
        Retry
      </button>
    </div>

    <p v-else-if="!catalog.length" class="text-muted">No lessons yet.</p>

    <div v-else class="row g-4">
      <div
        v-for="lesson in catalog"
        :key="lesson.id"
        class="col-12 col-md-6 col-xl-4"
      >
        <div class="card lesson h-100">
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">{{ lesson.title }}</h5>
            <p class="card-text small mt-auto">
              <span :class="['badge', progress(lesson).badge]">
                {{ progress(lesson).label }}
              </span>
              <span v-if="progress(lesson).detail" class="text-muted ms-2">
                {{ progress(lesson).detail }}
              </span>
            </p>
            <router-link
              :to="{ name: 'InquiryLesson', params: { lessonId: lesson.id } }"
              class="btn btn-primary align-self-end"
            >
              {{ progress(lesson).action }}
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from "vuex";

function shortDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default {
  name: "InquiryHomeView",
  computed: mapState("inquiry", ["catalog", "catalogStatus"]),
  mounted() {
    this.load();
  },
  methods: {
    load() {
      this.$store.dispatch("inquiry/loadCatalog");
    },
    progress({ progress: p }) {
      if (!p) {
        return {
          label: "Not started",
          badge: "bg-secondary",
          detail: "",
          action: "Start",
        };
      }
      if (p.status === "completed") {
        return {
          label: "Completed",
          badge: "bg-success",
          detail: shortDate(p.completedAt),
          action: "Review",
        };
      }
      return {
        label: "In progress",
        badge: "bg-warning text-dark",
        detail: `Page ${p.page} of ${p.pageCount} · ${shortDate(p.updatedAt)}`,
        action: "Continue",
      };
    },
  },
};
</script>

<style scoped>
/* App.vue sets height and max-width on every div; undo both so cards fit
   their content and the Bootstrap row keeps its full width */
div {
  height: auto;
}
.row {
  max-width: none;
}
.lesson {
  border: 3px inset #615195;
}
</style>
