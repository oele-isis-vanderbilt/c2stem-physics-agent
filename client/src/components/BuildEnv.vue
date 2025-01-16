<template>
  <iframe
    src="https://physics.c2stem.org"
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

export default {
  name: "BuildEnv",
  data() {
    return {
      chat_URL: "",
    };
  },
  computed: {
    getChatURL() {
      return this.chat_URL;
    },
  },
  methods: {
    sendActions(data) {
      this.socket.send(JSON.stringify(data));
    },
    sendState(state) {
      this.socket.send(JSON.stringify(state));
    },
  },
  mounted() {
    const astController = new ASTController(
      "blocks",
      "treeRoots",
      "actionList"
    );
    let ifr_window = document.getElementById("iframe-id");
    this.api = new window.EmbeddedNetsBloxAPI(ifr_window);
    ifr_window.onload = () => {
      this.api.addActionListener((action) => {
        if (action.type !== "openProject") {
          this.sendActions({ type: "action", data: action });
          astController.actionListener(action);
          let state = BlockParser.generate("treeRoots");
          this.sendState({ type: "state", data: state });
        }
      });
      this.api.addEventListener("startScript", console.log);
    };

    this.socket = Websockets.connect();
    this.socket.onmessage = (event) => {
      if (event.data.includes("URL")) {
        this.chat_URL = event.data.split("URL=")[1];
        console.log(this.chat_URL);
      }
      console.log(event.data);
    };
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
