<template>
  <!-- Construct View for CMISE -->
  <div class="container">
    <iframe-loader
      source="https:/physics.c2stem.org"
      iframeid="iframe-id"
      username="oele"
      projectname="Truck_Model_full_empty_HIDDEN_BLOCKS"
      :embed="false"
    ></iframe-loader>
    <button
      type="button"
      class="btn btn-primary btn-lg rounded-circle chat-btn bottom-0 end-0"
      @click="toggleCollapse"
      aria-controls="collapseWindow"
    >
      <i class="bi bi-chat-left-fill fs-2"></i>
    </button>
    <div class="collapse bottom-0 end-0" id="collapseWindow">
      <div class="card card-body mb-5">
        <iframe
          v-if="chat_URL.length !== 0"
          :src="chat_URL"
          id="chat-iframe"
          sandbox="allow-scripts allow-same-origin"
          height="100%"
          width="100%"
        ></iframe>
        <iframe
          v-else
          src="https://agent.c2-stem.org"
          id="chat-iframe"
          sandbox="allow-scripts allow-same-origin"
          height="100%"
          width="100%"
        >
        </iframe>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Construct view.
 * In this view User will have access to a C2STEM project in an iframe.
 * @requires ../components/IframeLoader.vue to display a c2stem environment in an iframe.
 */
import IframeLoader from "../components/IframeLoader.vue";
import { Collapse } from "bootstrap";
import ASTController from "../services/ASTController";
import Websockets from "@/services/Websockets";
import BlockParser from "@/services/BlockParser_v1";
import ActionScorer from "@/services/ActionScorer";
import SegmentParser from "@/services/SegmentParser";
// import simulation from "../services/Simulation.js";

export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: "ConstructWAgent",
  components: {
    IframeLoader,
  },
  data() {
    return {
      projectName: "Truck_Model_full_empty_HIDDEN_BLOCKS",
      chat_URL: "",
      lastGroup: "",
      username: "",
      collapseInstance: null,
    };
  },
  computed: {
    getChatURL() {
      return this.chat_URL;
    },
    getScore() {
      return this.$store.getters.getScore;
    },
    getSegment() {
      return this.$store.getters.getSegment;
    },
  },
  methods: {
    toggleCollapse() {
      if (this.collapseInstance) {
        this.collapseInstance.toggle();
      }
    },
    saveProject() {
      this.emitter.emit("save-project", { status: true });
    },
    getUser() {
      return sessionStorage.getItem("user");
    },
    sendActions(data) {
      data = data ? data : "";
      this.socket.send(JSON.stringify(data));
    },
    sendState(state) {
      state = state ? state : "";
      this.socket.send(JSON.stringify(state));
    },
    sendActionGroup(action) {
      let group = this.$store.getters.getCurrentGroup;
      let name = this.$store.getters.getCurrentActionName;
      if (
        action.args[1] === "item_0" &&
        name !== "receiveGo" &&
        name !== "doSimulationStep"
      ) {
        this.lastGroup = "DRAFT";
        this.socket.send(JSON.stringify({ type: "group", data: "DRAFT" }));
      } else {
        if (group) {
          let exists = !!action.args[3]?.[1];
          if (exists && typeof action.args[3][1] === "object") {
            group = "DRAFT";
          }
          this.lastGroup = group;
          this.socket.send(JSON.stringify({ type: "group", data: group }));
        } else {
          this.socket.send(
            JSON.stringify({ type: "group", data: "VISUALIZE" })
          );
        }
      }
    },
    sendScore(score) {
      score = score ? score : {};
      this.socket.send(JSON.stringify(score));
    },
    sendSegment(segment) {
      segment = segment ? segment : "";
      this.socket.send(JSON.stringify(segment));
    },
    setupSocket(username) {
      this.socket = Websockets.connect(username);
      this.socket.onmessage = (event) => {
        if (event.data.includes("URL")) {
          this.chat_URL = event.data.split("URL=")[1] + "?username=" + username;
          console.log(this.chat_URL);
        }
        console.log(event.data);
        let state = BlockParser.generate(this.$store);
        if (state.trim().length > 1) {
          this.sendState({ type: "state", data: state });
        }
      };
      this.socket.onclose = () => {
        console.log("Disconnected from the WebSocket server");
        this.setupSocket();
      };
    },
  },
  mounted() {
    this.username = this.getUser();
    let blocks = this.$store.getters.getBlocks;
    let treeRoots = this.$store.getters.getTreeRoots;
    let actions = this.$store.getters.getActions;
    const astController = new ASTController(
      blocks,
      treeRoots,
      actions,
      this.$store
    );
    const actionScorer = new ActionScorer(
      "blocks",
      "treeRoots",
      "actionList",
      this.$store
    );
    const segmentparser = new SegmentParser();
    let ifr_window = document.getElementById("iframe-id");
    this.api = new window.EmbeddedNetsBloxAPI(ifr_window);

    // Initialize collapse manually
    const collapseElement = document.getElementById("collapseWindow");
    this.collapseInstance = new Collapse(collapseElement, { toggle: false });

    setTimeout(() => {
      this.api.addActionListener((action) => {
        if (action.type !== "openProject") {
          this.sendActions({ type: "action", data: action });
          astController.actionListener(action, segmentparser);
          this.sendActionGroup(action);
          let state = BlockParser.generate(this.$store);
          actionScorer.updateScore(state);
          this.sendState({ type: "state", data: state });
          this.sendScore({ type: "score", data: this.getScore });
          this.sendSegment({ type: "segment", data: this.getSegment });
        }
      });
      this.api.addEventListener("startScript", console.log);
      this.api.addEventListener("projectSaved", this.saveProject);
    }, 2000);

    // };
    // let username = document.cookie.split("=")[1];
    this.setupSocket(this.username);
  },
};
</script>

<style scoped>
.container {
  max-width: 100%;
  height: 90%;
  padding: 0;
  background-color: #1e1e1e;
}
.btn {
  margin-right: 5px;
  margin-left: 5px;
}
.modal-body {
  display: flex;
  justify-content: center;
}
.modal-dialog {
  display: flex;
  align-items: center;
}

.modal-content {
  background-color: rgba(0, 0, 0, 0.0001) !important;
  border: 0;
}

strong {
  font-size: x-large;
  color: aliceblue;
}

#collapseWindow {
  position: absolute;
  width: 30%;
  max-height: 90%;
  margin: 60px;
  left: 60%;
  overflow: hidden;
  transition: height 0.35s ease;
}
.card {
  height: 100%;
}
.chat-btn {
  position: absolute;
  width: 80px;
  height: 80px;
  margin: 30px;
}
</style>
