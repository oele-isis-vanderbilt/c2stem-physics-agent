import { createStore } from "vuex";
import { Room } from "livekit-client";
import VuexPersistence from "vuex-persist";

const vuexLocal = new VuexPersistence({
  storage: window.sessionStorage,
  key: "store",
});

const store = createStore({
  state: {
    livekitRoom: Room,
    treeRoots: [],
    blocks: {},
    actions: [],
    currentGroup: "",
    currentActionName: "",
    currentSegment: "",
    score: {
      initialize_velocity: 0,
      initialize_position: 0,
      initialize_acceleration: 0,
      initialize_deltaT: 0,
      start_simulation: 0,
      accurate_comparison_position_velocity_time: 0,
      accurate_comparison_velocity_acceleration_time: 0,
      update_order_of_velocity_position: 0,
      code_accuracy_to_accelerate_truck: 0,
      setting_acceleration_to_cruise_truck: 0,
      setting_acceleration_to_decelerate_truck: 0,
      stop_simulation: 0,
      code_accuracy_to_cruise_truck: 0,
      code_accuracy_to_slowdown_truck: 0,
      code_accuracy_to_stop_truck: 0,
      accurate_acceleration_velocity_for_cruising: 0,
      accurate_acceleration_position_for_slowing: 0,
      accurate_code_for_stopping: 0,
      accurate_order_cruising_slowing_stopping: 0,
      physics_mastery: 0,
      computing_mastery: 0,
      overall_mastery: 0,
    },
    user: "",
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
    getCurrentGroup(state) {
      return state.currentGroup;
    },
    getCurrentActionName(state) {
      return state.currentActionName;
    },
    getScore(state) {
      return state.score;
    },
    getSegment(state) {
      return state.currentSegment;
    },
    loggedIn(state) {
      return !!state.user;
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
    updateCurrentGroup(state, group) {
      state.currentGroup = group;
    },
    updateCurrentActionName(state, name) {
      state.currentActionName = name;
    },
    updateScore(state, score) {
      state.score = score;
    },
    updateSegment(state, segment) {
      state.currentSegment = segment;
    },
    saveCredentials(state, data) {
      state.user = data.username;
    },
    removeCredentials(state) {
      state.user = null;
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
    updateCurrentGroup(context, group) {
      context.commit("updateCurrentGroup", group);
    },
    updateCurrentActionName(context, name) {
      context.commit("updateCurrentActionName", name);
    },
    updateScore(context, score) {
      context.commit("updateScore", score);
    },
    updateSegment(context, segment) {
      context.commit("updateSegment", segment);
    },
    saveCredentials(context, data) {
      context.commit("saveCredentials", data);
    },
    removeCredentials(context) {
      context.commit("removeCredentials");
    },
  },
  modules: {},
  plugins: [vuexLocal.plugin],
});

export default store;
