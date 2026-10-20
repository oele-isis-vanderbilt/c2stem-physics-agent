/**
 * Lesson 1: Push the Cart. Scored from the block tree of the Cart sprite.
 *
 * Rubric: 18 physics items and 9 computing items, 1 point each.
 * Expert model: oele/Pushcart_expert. Starter: NaveedMohd/ssmv-pushcart.
 *
 * Matching rules
 *  - variable names ignore spaces, "?" and case ("is pushing?" = "ispushing")
 *  - numbers compare as numbers ("5" = "5.0")
 *  - + and × accept the operands in either order
 *  - "a > b" also matches "b < a"
 *  - computing items check where blocks are, never their values
 */
import BlockParser from "@/services/BlockParser_v3";
import TreeSegmentParser from "@/services/TreeSegmentParser";
import tree from "@/services/scoring/treeUtils";
import mastery from "@/services/scoring/mastery";

const p = tree.pattern;

// Release condition: x_velocity > T (or >=), with T in this range
const RELEASE_MIN = 4.6;
const RELEASE_MAX = 4.75;

// Variable names in the expert ("pushing") and the starter ("is pushing?")
const VARIABLES = {
  pushForce: ["push force"],
  frictionForce: ["friction force"],
  pushing: ["pushing", "is pushing?"],
  time: ["time"],
};

const PHYSICS_ITEMS = [
  "initialize_position",
  "initialize_velocity",
  "initialize_acceleration",
  "initialize_push_force",
  "initialize_friction_force",
  "initialize_net_force",
  "initialize_mass",
  "initialize_pushing",
  "initialize_time",
  "initialize_deltaT",
  "release_condition",
  "set_pushing_false_in_release",
  "set_net_force_in_release",
  "update_acceleration_in_release",
  "update_velocity",
  "update_position",
  "update_time",
  "stop_condition",
];

const COMPUTING_ITEMS = [
  "green_flag_at_top_of_initialization",
  "initialization_order",
  "start_simulation_at_end",
  "simulation_step_at_top",
  "release_if_before_updates",
  "updates_inside_release_if",
  "update_order_velocity_position",
  "stop_if_at_bottom",
  "stop_simulation_inside_stop_if",
];

const MASTERY_ITEMS = [
  "physics_mastery",
  "computing_mastery",
  "overall_mastery",
];

// Expressions
const pushForce = p.variable(...VARIABLES.pushForce);
const frictionForce = p.variable(...VARIABLES.frictionForce);
const netForceOverMass = p.op(
  "reportQuotient",
  p.reporter("xNetForce"),
  p.reporter("mass")
);
const pushMinusFriction = p.op("reportDifference", pushForce, frictionForce);
const releasedNetForce = p.anyOf(
  p.op("reportDifference", p.number(0), frictionForce),
  p.commutative("reportProduct", p.number(-1), frictionForce)
);
const any = () => true;

// Block tests
function isSetter(block, selector, value = any) {
  return block.name === selector && value(tree.input(block, 0));
}

function isVariableBlock(block, selector, names, value = any) {
  const name = tree.literalText(tree.input(block, 0));
  return (
    block.name === selector &&
    name !== null &&
    names.map(tree.normalizeName).includes(tree.normalizeName(name)) &&
    value(tree.input(block, 1))
  );
}

function isSetVar(block, names, value = any) {
  return isVariableBlock(block, "doSetVar", names, value);
}

function isBool(expected) {
  return (node) => tree.boolValue(node) === expected;
}

function isIf(block) {
  return block.name === "doIf" || block.name === "doIfElse";
}

function isReleaseCondition(node) {
  const c = tree.comparison(node);
  if (!c || !p.reporter("xVelocity")(c.right)) return false;
  const threshold = tree.numberValue(c.left);
  return (
    threshold !== null && threshold >= RELEASE_MIN && threshold <= RELEASE_MAX
  );
}

function isStopCondition(node) {
  const c = tree.comparison(node);
  return (
    !!c && p.reporter("xVelocity")(c.left) && tree.numberValue(c.right) === 0
  );
}

function hasStopInBody(ifBlock) {
  return tree
    .bodies(ifBlock)
    .some((body) => body.some((b) => b.name === "stopSimulation"));
}

// Every block inside an if's bodies, nested ones included, in script order
function blocksInside(ifBlock) {
  return tree.walk(tree.bodies(ifBlock).flat()).map((entry) => entry.block);
}

const INIT_SELECTORS = [
  "setMass",
  "setDeltaTime",
  "setPhysicsXPosition",
  "setXVelocity",
  "setXNetForce",
  "setXAcceleration",
];
const LESSON_VARIABLES = Object.values(VARIABLES).flat();

function isInitBlock(block) {
  return (
    INIT_SELECTORS.includes(block.name) || isSetVar(block, LESSON_VARIABLES)
  );
}

function scoreTree(roots) {
  const flagScripts = roots
    .filter((root) => root.name === "receiveGo")
    .map(tree.scriptBody);
  const stepScripts = roots
    .filter((root) => root.name === "doSimulationStep")
    .map(tree.scriptBody);

  const initBlocks = flagScripts.flatMap((body) =>
    tree.walk(body).map((entry) => entry.block)
  );
  const stepEntries = stepScripts.flatMap((body) => tree.walk(body));
  const stepBlocks = stepEntries.map((entry) => entry.block);
  const inInit = (test) => initBlocks.some(test);
  const inStep = (test) => stepBlocks.some(test);

  // The stop if holds stop simulation or tests x_velocity < 0; every other if
  // in the simulation step is a candidate release if
  const stopIfs = stepBlocks.filter(
    (b) => isIf(b) && (hasStopInBody(b) || isStopCondition(tree.input(b, 0)))
  );
  const releaseIfs = stepBlocks.filter((b) => isIf(b) && !stopIfs.includes(b));
  const inRelease = (test) =>
    releaseIfs.some((ifBlock) => blocksInside(ifBlock).some(test));

  // Net force after release: 0 − friction, −1 × friction, or push force set
  // to 0 followed by push − friction
  const netForceInRelease = releaseIfs.some((ifBlock) => {
    const blocks = blocksInside(ifBlock);
    if (blocks.some((b) => isSetter(b, "setXNetForce", releasedNetForce))) {
      return true;
    }
    const zeroPush = blocks.findIndex((b) =>
      isSetVar(b, VARIABLES.pushForce, p.number(0))
    );
    return (
      zeroPush >= 0 &&
      blocks
        .slice(zeroPush + 1)
        .some((b) => isSetter(b, "setXNetForce", pushMinusFriction))
    );
  });

  const indexIn = (body, test) => body.findIndex(test);
  const isChangeVelocity = (b) => b.name === "changeXVelocity";
  const isChangePosition = (b) => b.name === "changePhysicsXPosition";

  const items = {
    // Physics: initialization
    initialize_position: inInit((b) =>
      isSetter(b, "setPhysicsXPosition", p.number(0))
    ),
    initialize_velocity: inInit((b) =>
      isSetter(b, "setXVelocity", p.number(0))
    ),
    initialize_acceleration: inInit((b) =>
      isSetter(b, "setXAcceleration", netForceOverMass)
    ),
    initialize_push_force: inInit((b) =>
      isSetVar(b, VARIABLES.pushForce, p.number(10))
    ),
    initialize_friction_force: inInit((b) =>
      isSetVar(b, VARIABLES.frictionForce, p.number(2.5))
    ),
    initialize_net_force: inInit((b) =>
      isSetter(b, "setXNetForce", pushMinusFriction)
    ),
    initialize_mass: inInit((b) => isSetter(b, "setMass", p.number(5))),
    initialize_pushing: inInit((b) =>
      isSetVar(b, VARIABLES.pushing, isBool(true))
    ),
    initialize_time: inInit((b) => isSetVar(b, VARIABLES.time, p.number(0))),
    initialize_deltaT: inInit((b) =>
      isSetter(b, "setDeltaTime", p.number(0.1))
    ),

    // Physics: simulation step
    release_condition: inStep(
      (b) => isIf(b) && isReleaseCondition(tree.input(b, 0))
    ),
    set_pushing_false_in_release: inRelease((b) =>
      isSetVar(b, VARIABLES.pushing, isBool(false))
    ),
    set_net_force_in_release: netForceInRelease,
    update_acceleration_in_release: inRelease((b) =>
      isSetter(b, "setXAcceleration", netForceOverMass)
    ),
    update_velocity: inStep((b) =>
      isSetter(
        b,
        "changeXVelocity",
        p.commutative(
          "reportProduct",
          p.reporter("xAcceleration"),
          p.reporter("deltaTime")
        )
      )
    ),
    update_position: inStep((b) =>
      isSetter(
        b,
        "changePhysicsXPosition",
        p.commutative(
          "reportProduct",
          p.reporter("xVelocity"),
          p.reporter("deltaTime")
        )
      )
    ),
    update_time: inStep((b) =>
      isVariableBlock(b, "doChangeVar", VARIABLES.time, p.reporter("deltaTime"))
    ),
    stop_condition: inStep((b) => isIf(b) && isStopCondition(tree.input(b, 0))),

    // Computing: initialization
    green_flag_at_top_of_initialization: flagScripts.some((body) =>
      body.some(isInitBlock)
    ),
    initialization_order: flagScripts.some((body) => {
      const blocks = tree.walk(body).map((entry) => entry.block);
      const push = indexIn(blocks, (b) => isSetVar(b, VARIABLES.pushForce));
      const friction = indexIn(blocks, (b) =>
        isSetVar(b, VARIABLES.frictionForce)
      );
      const net = indexIn(blocks, (b) => b.name === "setXNetForce");
      return push >= 0 && friction >= 0 && net > push && net > friction;
    }),
    start_simulation_at_end: flagScripts.some(
      (body) =>
        body.length > 0 && body[body.length - 1].name === "startSimulation"
    ),

    // Computing: simulation step
    simulation_step_at_top: stepBlocks.some(
      (b) => isChangeVelocity(b) || isChangePosition(b)
    ),
    release_if_before_updates: stepScripts.some((body) => {
      const release = indexIn(body, (b) => releaseIfs.includes(b));
      return (
        release >= 0 &&
        indexIn(body, isChangeVelocity) > release &&
        indexIn(body, isChangePosition) > release
      );
    }),
    updates_inside_release_if: releaseIfs.some((ifBlock) => {
      const blocks = blocksInside(ifBlock);
      return (
        blocks.some((b) => isSetVar(b, VARIABLES.pushing)) &&
        blocks.some((b) => b.name === "setXNetForce") &&
        blocks.some((b) => b.name === "setXAcceleration")
      );
    }),
    update_order_velocity_position: stepScripts.some((body) => {
      const velocity = indexIn(body, isChangeVelocity);
      return velocity >= 0 && indexIn(body, isChangePosition) > velocity;
    }),
    stop_if_at_bottom: stepScripts.some(
      (body) => body.length > 0 && stopIfs.includes(body[body.length - 1])
    ),
    stop_simulation_inside_stop_if: stepEntries.some(
      (entry) =>
        entry.block.name === "stopSimulation" &&
        entry.enclosing.length > 0 &&
        isIf(entry.enclosing[entry.enclosing.length - 1])
    ),
  };

  const score = {};
  for (const key of [...PHYSICS_ITEMS, ...COMPUTING_ITEMS]) {
    score[key] = items[key] ? 1 : 0;
  }
  score.physics_mastery = mastery(score, PHYSICS_ITEMS);
  score.computing_mastery = mastery(score, COMPUTING_ITEMS);
  score.overall_mastery = mastery(score, [
    ...PHYSICS_ITEMS,
    ...COMPUTING_ITEMS,
  ]);
  return score;
}

export default {
  id: "lesson1",
  parser: BlockParser,
  targetSprites: ["Cart"],
  physicsItems: PHYSICS_ITEMS,
  computingItems: COMPUTING_ITEMS,
  initialScore() {
    return Object.fromEntries(
      [...PHYSICS_ITEMS, ...COMPUTING_ITEMS, ...MASTERY_ITEMS].map((key) => [
        key,
        0,
      ])
    );
  },
  scoreTree,
  createSegmenter(store) {
    // Only the Cart is segmented; Pusher actions keep the current segment
    return new TreeSegmentParser(store, this.targetSprites);
  },
  createScorer(store) {
    return {
      // Scored from the tree; the AST string is not needed
      updateScore(ast, roots) {
        store.dispatch("updateScore", scoreTree(roots));
      },
    };
  },
};
