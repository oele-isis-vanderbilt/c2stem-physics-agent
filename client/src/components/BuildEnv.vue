<template>
  <iframe
    src=" https://physics.c2stem.org/?action=present&Username=oele&ProjectName=Truck_Model_full_empty_HIDDEN_BLOCKS&noExitWarning&noRun&editMode&noExitWarning"
    id="iframe-id"
    sandbox="allow-scripts allow-same-origin"
    height="100%"
    width="100%"
    frameborder="0"
  ></iframe>
  <button
    type="button"
    class="btn btn-primary btn-lg rounded-circle chat-btn bottom-0 end-0"
    draggable="true"
    data-bs-toggle="collapse"
    data-bs-target="#collapseWindow"
    aria-expanded="false"
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
        src="https://login.c2stem.org"
        id="chat-iframe"
        sandbox="allow-scripts allow-same-origin"
        height="100%"
        width="100%"
      >
      </iframe>
    </div>
  </div>
</template>
<script>
import Websockets from "@/services/Websockets";
import BlockParser from "@/services/BlockParser";
import ASTController from "@/services/ASTController";
import ActionScorer from "@/services/ActionScorer";
import SegmentParser from "@/services/SegmentParser";

export default {
  name: "BuildEnv",
  data() {
    return {
      chat_URL: "",
      lastGroup: "",
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
    setupSocket() {
      this.socket = Websockets.connect();
      this.socket.onmessage = (event) => {
        if (event.data.includes("URL")) {
          this.chat_URL = event.data.split("URL=")[1];
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
    // ifr_window.onload = () => {
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
    }, 2000);

    // };
    this.setupSocket();
  },
};
</script>
<style>
div {
  min-height: 0;
  height: 100%;
}

iframe {
  width: 100%;
  height: 100%; //display: block;
}

.chat-btn {
  position: absolute;
  width: 80px;
  height: 80px;
  margin: 30px;
}

#collapseWindow {
  position: absolute;
  width: 30%;
  height: 90%;
  margin: 60px;
  left: 60%;
}

.card {
  height: 100%;
}
</style>
