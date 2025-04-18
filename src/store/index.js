import { createStore } from "vuex";
import { Room } from "livekit-client";

const store = createStore({
  state: {
    livekitRoom: Room,
    treeRoots: Object,
    blocks: Object,
    actions: Object,
  },
  getters: {
    getLiveKitRoom(state) {
      return state.livekitRoom;
    },
    getTreeRoots(state) {
      return state.treeRoots;
    },
    getBlocks(state) {
      return state.blocks;
    },
    getActions(state) {
      return state.actions;
    },
  },
  mutations: {
    addLivekitRoom(state, data) {
      state.livekitRoom = data.room;
    },
    updateTreeRoots(state, treeRoot) {
      state.treeRoots = treeRoot;
    },
    updateBlocks(state, blocks) {
      state.blocks = blocks;
    },
    updateActions(state, actions) {
      state.actions = actions;
    },
  },
  actions: {
    addLivekitRoom(context, data) {
      context.commit("addLivekitRoom", data);
    },
    updateTreeRoots(context, treeRoot) {
      context.commit("updateTreeRoots", treeRoot);
    },
    updateBlocks(context, blocks) {
      context.commit("updateBlocks", blocks);
    },
    updateActions(context, actions) {
      context.commit("updateActions", actions);
    },
  },
  modules: {},
});
export default store;
