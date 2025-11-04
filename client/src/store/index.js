import { createStore } from "vuex";

const store = createStore({
  state: {
    treeRoots: [],
    blocks: {},
    actions: [],
    currentGroup: "",
    currentActionName: "",
    currentSegment: "",
    // sprites: { item_12: "Target", item_6: "Package", item_0: "Drone" },
    sprites: {
      "item_-1": "Tower",
      "item_-1_4": "Target",
      "item_-1_8": "Target2",
      "item_-1_12": "Package",
      "item_-1_36": "Package2",
      "item_-1_65": "Drone",
    },
    two_drone_score: {
      drone_initialize_x_position: 0,
      drone_initialize_y_position: 0,
      drone_initialize_x_velocity: 0,
      drone_initialize_y_velocity: 0,
      drone_update_x_position: 0,
      drone_update_y_position: 0,
      drone_initialize_deltaT: 0,
      drone_start_simulation: 0,
      package_initialize_x_position: 0,
      package_initialize_y_position: 0,
      package_initialize_x_velocity: 0,
      package_initialize_y_velocity: 0,
      package_initialize_x_acceleration: 0,
      package_initialize_y_acceleration: 0,
      package_update_x_position: 0,
      package_update_y_position: 0,
      package_update_x_velocity: 0,
      package_update_y_velocity: 0,
      package_initialize_deltaT: 0,
      package_start_simulation: 0,
      package_update_order_of_position_velocity: 0,
      package_accurate_comparison_with_target_position: 0,
      package_accurate_x_velocity_inside_if: 0,
      package_accurate_y_velocity_inside_if: 0,
      package_update_position_velocity_above_if: 0,
      package2_initialize_x_position: 0,
      package2_initialize_y_position: 0,
      package2_initialize_x_velocity: 0,
      package2_initialize_y_velocity: 0,
      package2_initialize_x_acceleration: 0,
      package2_initialize_y_acceleration: 0,
      package2_update_x_position: 0,
      package2_update_y_position: 0,
      package2_update_x_velocity: 0,
      package2_update_y_velocity: 0,
      package2_initialize_deltaT: 0,
      package2_start_simulation: 0,
      package2_accurate_condition_x_position: 0,
      package2_accurate_condition_y_position: 0,
      package2_condition_position_x_above_y: 0,
      package2_stop_simulation: 0,
      package2_update_position_above_if: 0,
      physics_mastery: 0,
      computing_mastery: 0,
      overall_mastery: 0,
    },
    // one_drone_score: {
    //   drone_initialize_x_position: 0,
    //   drone_initialize_y_position: 0,
    //   drone_initialize_x_velocity: 0,
    //   drone_initialize_y_velocity: 0,
    //   drone_update_x_position: 0,
    //   drone_update_y_position: 0,
    //   drone_initialize_deltaT: 0,
    //   drone_start_simulation: 0,
    //   package_initialize_x_position: 0,
    //   package_initialize_y_position: 0,
    //   package_initialize_x_velocity: 0,
    //   package_initialize_y_velocity: 0,
    //   package_initialize_x_acceleration: 0,
    //   package_initialize_y_acceleration: 0,
    //   package_update_x_position: 0,
    //   package_update_y_position: 0,
    //   package_update_x_velocity: 0,
    //   package_update_y_velocity: 0,
    //   package_initialize_deltaT: 0,
    //   package_start_simulation: 0,
    //   package_update_order_of_position_velocity: 0,
    //   package_accurate_comparison_with_target_position: 0,
    //   package_stop_simulation: 0,
    //   package_update_position_velocity_above_if: 0,
    //   drone_physics_mastery: 0,
    //   package_physics_mastery: 0,
    //   physics_mastery: 0,
    //   drone_computing_mastery: 0,
    //   package_computing_mastery: 0,
    //   computing_mastery: 0,
    //   overall_mastery: 0,
    // },
    // truck_score: {
    //   initialize_velocity: 0,
    //   initialize_position: 0,
    //   initialize_acceleration: 0,
    //   initialize_deltaT: 0,
    //   set_speed_limit: 0,
    //   start_simulation: 0,
    //   accurate_comparison_position_velocity_time: 0,
    //   accurate_comparison_velocity_acceleration_time: 0,
    //   update_order_of_velocity_position: 0,
    //   code_accuracy_to_accelerate_truck: 0,
    //   setting_acceleration_to_cruise_truck: 0,
    //   setting_acceleration_to_decelerate_truck: 0,
    //   stop_simulation: 0,
    //   code_accuracy_to_cruise_truck: 0,
    //   code_accuracy_to_slowdown_truck: 0,
    //   code_accuracy_to_stop_truck: 0,
    //   accurate_acceleration_velocity_for_cruising: 0,
    //   accurate_acceleration_position_for_slowing: 0,
    //   accurate_code_for_stopping: 0,
    //   accurate_order_cruising_slowing_stopping: 0,
    //   physics_mastery: 0,
    //   computing_mastery: 0,
    //   overall_mastery: 0,
    // },
    // farm_score: {
    //   initialize_velocity: 0,
    //   initialize_position: 0,
    //   initialize_acceleration: 0,
    //   initialize_deltaT: 0,
    //   start_simulation: 0,
    //   accurate_comparison_position_velocity_time: 0,
    //   accurate_comparison_velocity_acceleration_time: 0,
    //   update_order_of_velocity_position: 0,
    //   code_accuracy_to_accelerate_truck: 0,
    //   setting_acceleration_to_cruise_truck: 0,
    //   code_accuracy_to_cruise_truck: 0,
    //   accurate_acceleration_velocity_for_cruising: 0,
    //   physics_mastery: 0,
    //   computing_mastery: 0,
    //   overall_mastery: 0,
    // },
  },
  getters: {
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
      return state.two_drone_score;
    },
    getSegment(state) {
      return state.currentSegment;
    },
    getSprites(state) {
      return state.sprites;
    },
  },
  mutations: {
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
      state.two_drone_score = score;
    },
    updateSegment(state, segment) {
      state.currentSegment = segment;
    },
    setSprites(state, sprites) {
      state.sprites = sprites;
    },
  },
  actions: {
    // initializeStorage(context) {
    //   context.commit("initializeStorage");
    // },
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
    setSprites(context, sprites) {
      context.commit("setSprites", sprites);
    },
  },
  modules: {},
});

store.subscribe((mutation, state) => {
  // Store the state object as a JSON string
  sessionStorage.setItem("store", JSON.stringify(state));
});

export default store;
