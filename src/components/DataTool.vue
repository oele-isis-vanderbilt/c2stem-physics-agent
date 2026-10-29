<template>
  <!-- The data table tool for the current lesson; the header's Data table button brings it up -->
  <data-plot-tool
    v-if="config"
    ref="tool"
    :config.prop="config"
    :adapter.prop="adapter"
    :task-id="lessonId"
    :inert="frozen"
  ></data-plot-tool>
</template>

<script>
/**
 * Data table tool.
 * Students enter data in the lesson's fixed columns and see it plotted. The
 * table is saved to their account per lesson. While CoSMo's message holds the
 * workspace (frozen), the tool is under the overlay and takes no input.
 */
import { dataTableApi, getDataTable } from "@/datatool";

export default {
  name: "DataTool",
  props: {
    lessonId: {
      type: String,
      default: "",
    },
    frozen: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      adapter: dataTableApi,
    };
  },
  computed: {
    config() {
      return getDataTable(this.lessonId);
    },
  },
  methods: {
    // Closed or collapsed: bring it up. Open: collapse it to its title bar.
    toggle() {
      const tool = this.$refs.tool;
      if (!tool) return;
      if (tool.view === "closed") tool.open();
      else if (tool.view === "collapsed") tool.expand();
      else tool.collapse();
    },
  },
  mounted() {
    this.emitter.on("data-tool-toggle", this.toggle);
  },
  beforeUnmount() {
    this.emitter.off("data-tool-toggle", this.toggle);
  },
};
</script>

<style scoped>
data-plot-tool {
  /* Above the header and chat window, below CoSMo's focus overlay (1040) */
  --dpt-z-index: 1030;
}
</style>
