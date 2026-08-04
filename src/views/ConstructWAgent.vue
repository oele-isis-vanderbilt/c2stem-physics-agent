<template>
  <!-- Construct View for CMISE -->
  <div class="container">
    <iframe-loader
      :source="source"
      iframeid="iframe-id"
      :username="userID"
      :projectname="projectLessonName"
      :embed="false"
    ></iframe-loader>
    <button
      type="button"
      class="btn btn-dark btn-lg rounded-circle chat-btn bottom-0 end-0 btn-pulse"
      @click="toggleCollapse"
      aria-controls="collapseWindow"
    >
      <!--      <i class="bi bi-chat-left-fill fs-2"></i>-->
      <img src="../assets/peer_agent_image.png" alt="" width="60" height="60" />
    </button>
    <div class="collapse bottom-0 end-0" id="collapseWindow">
      <div class="card card-body mb-5">
        <iframe
          v-if="getChatURL.length !== 0"
          :src="getChatURL"
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
// import Websockets from "@/services/Websockets";
// import BlockParser from "@/services/BlockParser_v2";
import BlockParser from "@/services/BlockParser_v1_truck";
// import BlockParser from "@/services/BlockParser";
import ActionScorer from "@/services/ActionScorer";
import SegmentParser from "@/services/SegmentParser";
import Simulation from "../services/Simulation.js";
import EventXMLParser from "@/services/EventXMLParser";

export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: "ConstructWAgent",
  components: {
    IframeLoader,
  },
  data() {
    return {
      userID: this.$route.params.userID,
      projectLessonName: this.$route.params.projectName,
      source: this.$route.params.source,
      projectName: "Truck_Model_debug_HIDDEN_BLOCKS",
      chat_URL: "",
      lastGroup: "",
      username: "",
      collapseInstance: null,
      pendingNavigation: null,
      socket: null,
      autoSaveInterval: null,
    };
  },
  computed: {
    getChatURL() {
      return this.$store.getters.getAgentURL;
    },
    getScore() {
      return this.$store.getters.getScore;
    },
    getSegment() {
      return this.$store.getters.getSegment;
    },
    getSocket() {
      return this.$store.getters.getSocketInstance;
    },
  },
  methods: {
    async _replayHistoricalActions(astController, segmentparser) {
      // Skip if the store already has blocks (page refresh — VuexPersistence restored state).
      const existingBlocks = this.$store.getters.getBlocks;
      if (existingBlocks && Object.keys(existingBlocks).length > 0) {
        console.log(
          "[Replay] Store already has blocks — skipping historical replay"
        );
        return;
      }

      const username = this.$store.state.user;
      if (!username) return;

      const projectName = this.projectLessonName;

      let xmlString;
      try {
        console.log(`[Replay] Fetching project XML for "${projectName}"...`);
        const res = await fetch(
          "https://physics.c2stem.org/api/getProjectByName",
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ owner: username, projectName }),
          }
        );

        if (!res.ok) {
          console.warn(
            `[Replay] Server returned ${res.status} for project "${projectName}" — starting fresh`
          );
          return;
        }

        const raw = await res.text();
        // getProjectByName returns URL-encoded form data; extract the field whose
        // value starts with '<' — that is the NetsBlox project XML.
        if (raw.trimStart().startsWith("<")) {
          xmlString = raw;
        } else {
          const params = new URLSearchParams(raw);
          for (const value of params.values()) {
            if (value.trimStart().startsWith("<")) {
              xmlString = value;
              break;
            }
          }
          if (!xmlString) {
            console.warn(
              "[Replay] Response was URL-encoded but no XML field found — starting fresh"
            );
            return;
          }
        }
      } catch (err) {
        console.error("[Replay] Failed to fetch project XML:", err);
        return;
      }

      try {
        const historicalActions = EventXMLParser.parseXMLPeerContext(
          xmlString,
          username
        );

        if (historicalActions.length === 0) {
          console.log(
            `[Replay] No historical actions for "${username}" — starting fresh`
          );
          return;
        }

        console.log(
          `[Replay] Replaying ${historicalActions.length} actions for "${username}"`
        );
        for (const action of historicalActions) {
          astController.actionListener(action, segmentparser);
        }
        console.log("[Replay] Historical replay complete");
      } catch (err) {
        console.error("[Replay] Error during historical replay:", err);
      }
    },
    toggleCollapse() {
      if (this.collapseInstance) {
        this.collapseInstance.toggle();
      }
    },
    saveProject() {
      this.emitter.emit("save-project", { status: true });
    },
    async autoSaveProject() {
      const projectName = this.$store.getters.getProjectName;
      if (!projectName) {
        return;
      }

      try {
        console.log(`[Auto-save] Saving project "${projectName}"...`);
        await Simulation.saveToCloud(projectName);
        console.log(
          `[Auto-save] Project "${projectName}" saved successfully at ${new Date().toLocaleTimeString()}`
        );
      } catch (error) {
        console.error("[Auto-save] Failed to save project:", error);
      }
    },
    getUser() {
      return this.$store.state.user;
    },
    async sendActions(data) {
      if (!this.socket) {
        console.warn("Socket not initialized, cannot send actions");
        return;
      }
      data = data ? data : "";
      try {
        // Use sendWithAck for critical action messages
        await this.socket.sendWithAck(data);
      } catch (error) {
        console.error("Failed to send action:", error);
        // Message will be queued automatically if connection is down
      }
    },
    sendState(state) {
      if (!this.socket) {
        console.warn("Socket not initialized, cannot send state");
        return;
      }
      state.data = state.data ? state.data : "";
      // Use regular send for state updates (less critical)
      this.socket.send(state);
    },
    sendActionGroup(action) {
      if (!this.socket) {
        console.warn("Socket not initialized, cannot send action group");
        return;
      }
      let group = this.$store.getters.getCurrentGroup;
      let name = this.$store.getters.getCurrentActionName;
      if (
        action.args[1] === "item_0" &&
        !name.includes("receiveGo") &&
        !name.includes("doSimulationStep")
      ) {
        this.lastGroup = "DRAFT";
        this.socket.send({ type: "group", data: "DRAFT" });
      } else {
        if (group) {
          let exists = !!action.args[3]?.[1];
          if (
            exists &&
            typeof action.args[3][1] === "object" &&
            typeof action.args[1] !== "object"
          ) {
            group = "DRAFT";
          }
          this.lastGroup = group;
          this.socket.send({ type: "group", data: group });
        } else {
          this.socket.send({ type: "group", data: "VISUALIZE" });
        }
      }
    },
    sendScore(score) {
      if (!this.socket) {
        console.warn("Socket not initialized, cannot send score");
        return;
      }
      score.data = score.data ? score.data : {};
      this.socket.send(score);
    },
    sendSegment(segment) {
      if (!this.socket) {
        console.warn("Socket not initialized, cannot send segment");
        return;
      }
      segment.data = segment.data ? segment.data : "";
      this.socket.send(segment);
    },
    // for one v1 and v2 versions of block parser file with multiple headers
    // reconnectSocket(username, blockParser) {
    reconnectSocket(username) {
      console.log("Reconnecting WebSocket after page refresh...");

      const Websockets = require("@/services/Websockets").default;
      // const BlockParser = require("@/services/BlockParser_v1").default;

      const onMessage = (event) => {
        if (event.data.includes("URL")) {
          let chat_URL = event.data.split("URL=")[1] + "?username=" + username;
          this.$store.dispatch("setAgentURL", chat_URL);
          console.log(chat_URL);
        }
        console.log(event.data);
        // for one v1 and v2 versions of block parser file with multiple headers
        // let state = blockParser.generate(this.$store);
        let state = BlockParser.generate(this.$store);
        if (state.trim().length > 1) {
          Websockets.send({ type: "state", data: state });
        }
      };

      const onClose = (event) => {
        console.log("WebSocket connection closed", event.code, event.reason);
      };

      const onReconnect = () => {
        console.log("WebSocket reconnected successfully");
        Websockets.send({ type: "task", data: this.projectLessonName });
        let state = BlockParser.generate(this.$store);
        if (state.trim().length > 1) {
          Websockets.send({ type: "state", data: state });
        }
      };

      Websockets.connect(username, onMessage, onClose, onReconnect);
      this.$store.dispatch("setSocketInstance", Websockets);
      this.socket = Websockets;
    },
    setupSocket() {
      this.socket = this.getSocket;

      if (!this.socket) {
        const username = this.$store.state.user;
        if (username) {
          this.reconnectSocket(username);
        } else {
          console.error(
            "WebSocket service not initialized. Please log in again."
          );
          this.$router.push({ name: "login" });
          return;
        }
      }

      if (!this.socket.isConnected()) {
        console.warn("WebSocket not connected yet, messages will be queued");
      }

      // Tell the server which project is loaded so it can reset to the right task config
      this.socket.send({ type: "task", data: this.projectLessonName });
      console.log(`[Task] Sent task message: ${this.projectLessonName}`);
    },
  },
  beforeRouteLeave(to, from, next) {
    const projectName = this.$store.getters.getProjectName;
    if (projectName && !this.pendingNavigation) {
      this.pendingNavigation = next;

      // Call saveToCloud - wait for projectSaved event before navigating
      Simulation.saveToCloud(projectName).catch((error) => {
        console.error("Error saving project:", error);
        next();
        this.pendingNavigation = null;
      });
      // Don't call next() here - wait for projectSaved event
    } else if (this.pendingNavigation) {
      // Already saving, block navigation
      return;
    } else {
      next();
    }
  },
  mounted() {
    this.username = this.getUser();

    // Clear all task-specific state from the previous task so the store
    // starts fresh (empty blocks, treeRoots, scores, segment, agentURL).
    this.$store.dispatch("resetTaskState");

    let blocks = this.$store.getters.getBlocks;
    let treeRoots = this.$store.getters.getTreeRoots;
    let actions = [];
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
    // for one v1 and v2 versions of block parser file with multiple headers
    // const blockParser = new BlockParser(["DRONE", "PACKAGE", "PACKAGE2"]);
    let ifr_window = document.getElementById("iframe-id");
    this.api = new window.EmbeddedNetsBloxAPI(ifr_window);

    // Initialize collapse manually
    const collapseElement = document.getElementById("collapseWindow");
    this.collapseInstance = new Collapse(collapseElement, { toggle: false });

    // Wait for iframe NetsBlox IDE to fully initialize before wiring listeners.
    // openProject fires during iframe load (before this timeout), so by 8 seconds
    // the project is already open and getProjectXML() is safe to call.
    setTimeout(async () => {
      console.log("Setting up embedded API listeners...");

      // Replay historical actions from the REST API project XML.
      await this._replayHistoricalActions(astController, segmentparser);

      // Send the initial model state to the agent before any live action arrives.
      let initialState = BlockParser.generate(this.$store);
      if (initialState.trim().length > 1) {
        this.sendState({ type: "state", data: initialState });
        console.log("[Replay] Initial model state sent to agent");
      }

      this.api.addActionListener((action) => {
        if (action.type !== "openProject") {
          this.sendActions({ type: "action", data: action });
          astController.actionListener(action, segmentparser);
          this.sendActionGroup(action);
          this.$nextTick(() => {
            // for one v1 and v2 versions of block parser file with multiple headers
            // let state = blockParser.generate(this.$store);
            let state = BlockParser.generate(this.$store);
            actionScorer.updateScore(state);
            this.sendState({ type: "state", data: state });
            this.sendScore({ type: "score", data: this.getScore });
            this.sendSegment({ type: "segment", data: this.getSegment });
          });
        }
      });

      this.api.addEventListener("startScript", console.log);
      this.api.addEventListener("projectSaved", () => {
        this.saveProject();

        // If navigation is pending, allow it to proceed
        if (this.pendingNavigation) {
          this.pendingNavigation();
          this.pendingNavigation = null;
        }
      });
      console.log("Embedded API listeners set up successfully");
    }, 8000);

    // };
    // let username = document.cookie.split("=")[1];
    // for one v1 and v2 versions of block parser file with multiple headers
    // this.setupSocket(blockParser);
    this.setupSocket();

    // Set up auto-save every 2 minutes
    this.autoSaveInterval = setInterval(() => {
      this.autoSaveProject();
    }, 120000); // 2 minutes = 120000ms

    console.log("[Auto-save] Auto-save enabled (every 2 minutes)");
  },
  beforeUnmount() {
    // Clear the auto-save interval when component is destroyed
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      console.log("[Auto-save] Auto-save disabled");
    }
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
  height: 80px;
  margin: 40px;
  background: #8270ba;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgb(130, 132, 198);
  }

  70% {
    box-shadow: 0 0 0 10px rgba(0, 123, 255, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(0, 123, 255, 0);
  }
}

.btn-pulse {
  animation: pulse 1.5s infinite;
}
</style>
