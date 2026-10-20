/**
 * Truck: Debug. Scored by the original string-based ActionScorer, unchanged.
 */
import ActionScorer from "@/services/ActionScorer";
import BlockParser from "@/services/BlockParser_v1_truck";

const SCORE_KEYS = [
  "initialize_velocity",
  "initialize_position",
  "initialize_acceleration",
  "initialize_deltaT",
  "set_speed_limit",
  "start_simulation",
  "accurate_comparison_position_velocity_time",
  "accurate_comparison_velocity_acceleration_time",
  "update_order_of_velocity_position",
  "code_accuracy_to_accelerate_truck",
  "setting_acceleration_to_cruise_truck",
  "setting_acceleration_to_decelerate_truck",
  "stop_simulation",
  "code_accuracy_to_cruise_truck",
  "code_accuracy_to_slowdown_truck",
  "code_accuracy_to_stop_truck",
  "accurate_acceleration_velocity_for_cruising",
  "accurate_acceleration_position_for_slowing",
  "accurate_code_for_stopping",
  "accurate_order_cruising_slowing_stopping",
  "physics_mastery",
  "computing_mastery",
  "overall_mastery",
];

export default {
  id: "truck",
  parser: BlockParser,
  // null: every sprite's scripts are parsed and scored
  targetSprites: null,
  initialScore() {
    return Object.fromEntries(SCORE_KEYS.map((key) => [key, 0]));
  },
  createScorer(store) {
    const actionScorer = new ActionScorer(
      "blocks",
      "treeRoots",
      "actionList",
      store
    );
    return {
      // ActionScorer reads the AST string and dispatches "updateScore" itself
      updateScore(ast) {
        actionScorer.updateScore(ast);
      },
    };
  },
};
