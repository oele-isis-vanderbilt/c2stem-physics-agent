/**
 * Lesson 3: Ball drop. Scored from the block tree of the Ball sprite.
 *
 * Rubric: 17 physics items and 7 computing items, 1 point each.
 * Expert model: oele/Balldrop_expert. Starter: oele/Balldrop.
 *
 * Matching rules
 *  - variable names are the starter's, ignoring spaces, "?" and case
 *  - numbers compare as numbers ("1" = "1.0")
 *  - formulas are compared by value on sample inputs, so any equivalent form
 *    scores: mass × gravity, gravity × mass, −1 × (v × e), (−1 × v) × e, …
 *  - y position can be set by "set y_position" or "set position to x: y:";
 *    the last of them in the script is the drop height, and x can be anything
 *  - only the Ball sprite is read. The "gravity" variable is taken as +9.8, its
 *    value in the starter. The hidden gravity reporter is −9.81 in the project,
 *    so 9.8 to 9.81 counts as gravity
 *  - initial y acceleration is scored by its value (−9.8), however it is built
 *  - potential energy needs a formula with the value mass × 9.8 × y, positive:
 *    −1 × gravity × mass × y is negative with the variable, so it does not score;
 *    a number typed in does not score either
 *  - kinetic energy needs a formula equal to 0.5 × mass × velocity²
 *  - velocity update accepts acceleration × Δt, or −9.8 × Δt built any way
 *  - bounce velocity: set to −e × v, or change by −(1 + e) × v
 *  - collision: y < 0, y <= 0 or (y < 0 or y = 0), also written 0 > y
 *  - stop condition: abs(y velocity) < T, also written T > abs(y velocity),
 *    with 0.38 <= T <= 0.5 (0.4 in the expert; dropped from 7.8 at Δt 0.1 the last
 *    bounce speeds are 0.510 then 0.376, so a lower T never stops the ball)
 *  - computing items check where blocks are, never their values
 */
import BlockParser from "@/services/BlockParser_v3";
import TreeSegmentParser from "@/services/TreeSegmentParser";
import tree from "@/services/scoring/treeUtils";
import mastery from "@/services/scoring/mastery";

const p = tree.pattern;

const MASS = 1;
const RESTITUTION = 0.8;
const DELTA_T = 0.1;
// Drop height: 5 / 0.8² = 7.8125, written as about 7.8 in the task notes
const DROP_HEIGHT_MIN = 7.75;
const DROP_HEIGHT_MAX = 7.85;
const STOP_THRESHOLD_MIN = 0.38;
const STOP_THRESHOLD_MAX = 0.5;
const GRAVITY_MIN = 9.8;
const GRAVITY_MAX = 9.81;
// Value of the "gravity" variable in the starter (set on the Stage, not scored)
const GRAVITY_VARIABLE = 9.8;
// Saved value of the gravity reporter in the starter and the expert
const GRAVITY_REPORTER = -9.81;

// Variable names in the starter (oele/Balldrop)
const VARIABLES = {
  restitution: ["restitution"],
  time: ["time"],
  potentialEnergy: ["potential energy"],
  kineticEnergy: ["kinetic energy"],
  gravity: ["gravity"],
};

const PHYSICS_ITEMS = [
  "initialize_mass",
  "initialize_restitution",
  "initialize_deltaT",
  "initialize_time",
  "initialize_position",
  "initialize_velocity",
  "initialize_acceleration",
  "initialize_potential_energy",
  "initialize_kinetic_energy",
  "update_velocity",
  "update_position",
  "update_kinetic_energy",
  "update_potential_energy",
  "collision_condition",
  "update_velocity_on_collision",
  "stop_condition",
  "update_time",
];

const COMPUTING_ITEMS = [
  "green_flag_at_top_of_initialization",
  "start_simulation_at_end",
  "simulation_step_at_top",
  "update_order_velocity_position",
  "updates_above_collision_if",
  "stop_if_inside_collision_if",
  "stop_simulation_inside_stop_if",
];

const MASTERY_ITEMS = [
  "physics_mastery",
  "computing_mastery",
  "overall_mastery",
];

// Sample inputs for comparing formulas by value. Distinct, non-round values
// so that a wrong formula does not match by coincidence.
const SAMPLES = [
  { m: 1.9, e: 0.37, v: -2.3, a: 0.61, y: 3.3, dt: 0.07 },
  { m: 0.47, e: 0.59, v: 1.7, a: -3.2, y: 0.83, dt: 0.13 },
];

// Gravity keeps its real values, so formulas are compared by their real sign
function sampleEnv(s, gravity) {
  return {
    variables: {
      [tree.normalizeName(VARIABLES.restitution[0])]: s.e,
      [tree.normalizeName(VARIABLES.gravity[0])]: gravity,
    },
    reporters: {
      mass: s.m,
      yGravity: GRAVITY_REPORTER,
      yVelocity: s.v,
      yAcceleration: s.a,
      physicsYPosition: s.y,
      deltaTime: s.dt,
    },
  };
}

function sampleEnvs(gravity) {
  return SAMPLES.map((s) => [s, sampleEnv(s, gravity)]);
}

function close(actual, expected) {
  return (
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected))
  );
}

function isGravitySize(value) {
  return (
    close(value, GRAVITY_MIN) ||
    close(value, GRAVITY_MAX) ||
    (value > GRAVITY_MIN && value < GRAVITY_MAX)
  );
}

// Pattern: the expression has the value expected(sample) on every sample
function formula(envs, expected) {
  return (node) =>
    envs.every(([s, env]) => close(tree.evaluate(node, env), expected(s)));
}

// Pattern: value / divisor(sample) passes `test` on every sample
function scaledValue(envs, divisor, test) {
  return (node) =>
    envs.every(([s, env]) => test(tree.evaluate(node, env) / divisor(s)));
}

const yPosition = p.reporter("physicsYPosition");
const dropHeight = (node) => {
  const value = tree.numberValue(node);
  return value !== null && value >= DROP_HEIGHT_MIN && value <= DROP_HEIGHT_MAX;
};

// Block tests
function isSetter(block, selector, value) {
  return block.name === selector && value(tree.input(block, 0));
}

function isVariableBlock(block, selector, names, value) {
  const name = tree.literalText(tree.input(block, 0));
  return (
    block.name === selector &&
    name !== null &&
    names.map(tree.normalizeName).includes(tree.normalizeName(name)) &&
    value(tree.input(block, 1))
  );
}

function isSetVar(block, names, value) {
  return isVariableBlock(block, "doSetVar", names, value);
}

function isIf(block) {
  return block.name === "doIf" || block.name === "doIfElse";
}

function setsYPosition(block) {
  return (
    block.name === "setPhysicsYPosition" || block.name === "setPhysicsPosition"
  );
}

function isDropHeight(block) {
  const slot = block.name === "setPhysicsPosition" ? 1 : 0;
  return dropHeight(tree.input(block, slot));
}

// y < 0 or y <= 0 (also written 0 > y)
function isBelowFloor(node) {
  const c = tree.comparison(node);
  return !!c && yPosition(c.left) && tree.numberValue(c.right) === 0;
}

function isAtFloor(node) {
  return p.commutative("reportEquals", yPosition, p.number(0))(node);
}

function isCollisionCondition(node) {
  return (
    isBelowFloor(node) ||
    p.commutative("reportOr", isBelowFloor, isAtFloor)(node)
  );
}

function isStopCondition(node) {
  const c = tree.comparison(node);
  if (!c) return false;
  const isAbsVelocity =
    tree.isBlock(c.left) &&
    c.left.name === "reportMonadic" &&
    tree.literalText(tree.input(c.left, 0)) === "abs" &&
    p.reporter("yVelocity")(tree.input(c.left, 1));
  const threshold = tree.numberValue(c.right);
  return (
    isAbsVelocity &&
    threshold !== null &&
    threshold >= STOP_THRESHOLD_MIN &&
    threshold <= STOP_THRESHOLD_MAX
  );
}

// Does the expression hold a reporter with this selector?
function mentions(node, selector) {
  if (!tree.isBlock(node)) return false;
  return (
    node.name === selector ||
    tree.inputs(node).some((child) => mentions(child, selector))
  );
}

function bodyHas(ifBlock, test) {
  return tree.bodies(ifBlock).some((body) => body.some(test));
}

// The if for the collision: tests y position or holds the velocity change
function isCollisionIf(block) {
  return (
    isIf(block) &&
    (mentions(tree.input(block, 0), "physicsYPosition") ||
      bodyHas(
        block,
        (b) => b.name === "setYVelocity" || b.name === "changeYVelocity"
      ))
  );
}

// The if for stopping: holds stop simulation or tests the velocity
function isStopIf(block) {
  return (
    isIf(block) &&
    !isCollisionIf(block) &&
    (bodyHas(block, (b) => b.name === "stopSimulation") ||
      mentions(tree.input(block, 0), "yVelocity"))
  );
}

const INIT_SELECTORS = [
  "setMass",
  "setDeltaTime",
  "setPhysicsPosition",
  "setPhysicsYPosition",
  "setYVelocity",
  "setYAcceleration",
];
const LESSON_VARIABLES = Object.values(VARIABLES).flat();

function isInitBlock(block) {
  return (
    INIT_SELECTORS.includes(block.name) ||
    isSetVar(block, LESSON_VARIABLES, () => true)
  );
}

// Reporters that the initialization script can set, by setter selector
const SET_REPORTERS = {
  setMass: "mass",
  setDeltaTime: "deltaTime",
  setPhysicsYPosition: "physicsYPosition",
  setYVelocity: "yVelocity",
  setYNetForce: "yNetForce",
};

// Value of y acceleration after running the blocks in order, or NaN when it is
// never set or uses something not set yet
function initialAcceleration(blocks, gravity) {
  const env = {
    variables: { [tree.normalizeName(VARIABLES.gravity[0])]: gravity },
    reporters: { yGravity: GRAVITY_REPORTER },
  };
  let acceleration = NaN;
  for (const block of blocks) {
    if (block.name === "doSetVar") {
      const name = tree.literalText(tree.input(block, 0));
      if (name !== null) {
        env.variables[tree.normalizeName(name)] = tree.evaluate(
          tree.input(block, 1),
          env
        );
      }
    } else if (block.name === "setYAcceleration") {
      acceleration = tree.evaluate(tree.input(block, 0), env);
    } else if (SET_REPORTERS[block.name]) {
      env.reporters[SET_REPORTERS[block.name]] = tree.evaluate(
        tree.input(block, 0),
        env
      );
    }
  }
  return acceleration;
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
  const positionBlocks = initBlocks.filter(setsYPosition);

  const envs = sampleEnvs(GRAVITY_VARIABLE);
  const accelerationTimesDeltaT = formula(envs, (s) => s.a * s.dt);
  const gravityTimesDeltaT = scaledValue(
    envs,
    (s) => s.dt,
    (value) => isGravitySize(-value)
  );
  const velocityTimesDeltaT = formula(envs, (s) => s.v * s.dt);
  const collisionVelocity = formula(envs, (s) => -s.v * s.e);
  const collisionVelocityChange = formula(envs, (s) => -(1 + s.e) * s.v);
  const kineticEnergy = formula(envs, (s) => 0.5 * s.m * s.v * s.v);
  const potentialEnergy = scaledValue(envs, (s) => s.m * s.y, isGravitySize);

  const indexIn = (blocks, test) => blocks.findIndex(test);
  const isChangeVelocity = (b) => b.name === "changeYVelocity";
  const isChangePosition = (b) => b.name === "changePhysicsYPosition";

  const items = {
    // Physics: initialization
    initialize_mass: inInit((b) => isSetter(b, "setMass", p.number(MASS))),
    initialize_restitution: inInit((b) =>
      isSetVar(b, VARIABLES.restitution, p.number(RESTITUTION))
    ),
    initialize_deltaT: inInit((b) =>
      isSetter(b, "setDeltaTime", p.number(DELTA_T))
    ),
    initialize_time: inInit((b) => isSetVar(b, VARIABLES.time, p.number(0))),
    initialize_position:
      positionBlocks.length > 0 &&
      isDropHeight(positionBlocks[positionBlocks.length - 1]),
    initialize_velocity: inInit((b) =>
      isSetter(b, "setYVelocity", p.number(0))
    ),
    initialize_acceleration: isGravitySize(
      -initialAcceleration(initBlocks, GRAVITY_VARIABLE)
    ),
    initialize_potential_energy: inInit((b) =>
      isSetVar(b, VARIABLES.potentialEnergy, potentialEnergy)
    ),
    initialize_kinetic_energy: inInit((b) =>
      isSetVar(b, VARIABLES.kineticEnergy, kineticEnergy)
    ),

    // Physics: simulation step
    update_velocity: inStep((b) =>
      isSetter(
        b,
        "changeYVelocity",
        p.anyOf(accelerationTimesDeltaT, gravityTimesDeltaT)
      )
    ),
    update_position: inStep((b) =>
      isSetter(b, "changePhysicsYPosition", velocityTimesDeltaT)
    ),
    update_kinetic_energy: inStep((b) =>
      isSetVar(b, VARIABLES.kineticEnergy, kineticEnergy)
    ),
    update_potential_energy: inStep((b) =>
      isSetVar(b, VARIABLES.potentialEnergy, potentialEnergy)
    ),
    collision_condition: inStep(
      (b) => isIf(b) && isCollisionCondition(tree.input(b, 0))
    ),
    update_velocity_on_collision: stepEntries.some(
      (entry) =>
        entry.enclosing.length > 0 &&
        (isSetter(entry.block, "setYVelocity", collisionVelocity) ||
          isSetter(entry.block, "changeYVelocity", collisionVelocityChange))
    ),
    stop_condition: inStep((b) => isIf(b) && isStopCondition(tree.input(b, 0))),
    update_time: inStep((b) =>
      isVariableBlock(b, "doChangeVar", VARIABLES.time, p.reporter("deltaTime"))
    ),

    // Computing: initialization
    green_flag_at_top_of_initialization: flagScripts.some((body) =>
      body.some(isInitBlock)
    ),
    start_simulation_at_end: flagScripts.some(
      (body) =>
        body.length > 0 && body[body.length - 1].name === "startSimulation"
    ),

    // Computing: simulation step
    simulation_step_at_top: stepBlocks.some(
      (b) => isChangeVelocity(b) || isChangePosition(b)
    ),
    update_order_velocity_position: stepScripts.some((body) => {
      const velocity = indexIn(body, isChangeVelocity);
      const position = indexIn(body, isChangePosition);
      return velocity >= 0 && position > velocity;
    }),
    updates_above_collision_if: stepScripts.some((body) => {
      const velocity = indexIn(body, isChangeVelocity);
      const position = indexIn(body, isChangePosition);
      const collision = indexIn(body, isCollisionIf);
      return (
        velocity >= 0 &&
        position >= 0 &&
        collision > Math.max(velocity, position)
      );
    }),
    stop_if_inside_collision_if: stepEntries.some(
      (entry) => isStopIf(entry.block) && entry.enclosing.some(isCollisionIf)
    ),
    stop_simulation_inside_stop_if: stepEntries.some(
      (entry) =>
        entry.block.name === "stopSimulation" &&
        entry.enclosing.length > 0 &&
        isStopIf(entry.enclosing[entry.enclosing.length - 1])
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
  id: "lesson3",
  parser: BlockParser,
  targetSprites: ["Ball"],
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
