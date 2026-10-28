/**
 * Lesson 2: Spring-mass system in discrete time. Scored from the block tree
 * of the Crate sprite (the Spring sprite only draws the spring).
 *
 * Rubric: 19 physics items and 7 computing items, 1 point each.
 * Expert model: oele/Springmass_expert. Starter: oele/Springmass.
 *
 * Matching rules
 *  - variable names are the starter's, ignoring spaces, "?" and case
 *  - numbers compare as numbers ("1" = "1.0")
 *  - formulas are compared by value on sample inputs, so any equivalent form
 *    scores: −1 × k × x, 0 − k × x, (−1 × k) × x, k × x × x / 2, 0.5 × k × x², …
 *  - initial displacement and x position get different sample values, so a
 *    formula must use x position (initialization and simulation step alike)
 *  - "time > 8" also matches "8 < time" and ">="
 *  - computing items check where blocks are, never their values
 */
import BlockParser from "@/services/BlockParser_v3";
import TreeSegmentParser from "@/services/TreeSegmentParser";
import tree from "@/services/scoring/treeUtils";
import mastery from "@/services/scoring/mastery";

const p = tree.pattern;

const SPRING_STIFFNESS = 10;
const MASS = 1;
const DELTA_T = 0.1;
const STOP_TIME = 8;

// Variable names in the starter (oele/Springmass)
const VARIABLES = {
  springStiffness: ["spring stiffness"],
  displacement: ["initial displacement"],
  potentialEnergy: ["potential energy"],
  kineticEnergy: ["kinetic energy"],
  time: ["time"],
};

const PHYSICS_ITEMS = [
  "initialize_spring_stiffness",
  "initialize_mass",
  "initialize_initial_displacement",
  "initialize_position",
  "initialize_velocity",
  "initialize_time",
  "initialize_deltaT",
  "initialize_net_force",
  "initialize_acceleration",
  "initialize_potential_energy",
  "initialize_kinetic_energy",
  "update_net_force",
  "update_acceleration",
  "update_velocity",
  "update_position",
  "update_time",
  "update_potential_energy",
  "update_kinetic_energy",
  "stop_condition",
];

const COMPUTING_ITEMS = [
  "green_flag_at_top_of_initialization",
  "initialization_order",
  "start_simulation_at_end",
  "simulation_step_at_top",
  "update_order_force_acceleration_velocity_position",
  "stop_if_at_bottom",
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
  { k: 3.7, m: 1.9, x: 0.83, dx: -1.31, v: -2.3, a: 0.61, F: 4.1, dt: 0.07 },
  { k: 11.3, m: 0.47, x: -2.6, dx: 0.59, v: 1.7, a: -3.2, F: -0.9, dt: 0.13 },
];

function sampleEnv(s) {
  return {
    variables: {
      [tree.normalizeName(VARIABLES.springStiffness[0])]: s.k,
      [tree.normalizeName(VARIABLES.displacement[0])]: s.dx,
    },
    reporters: {
      physicsXPosition: s.x,
      xVelocity: s.v,
      xAcceleration: s.a,
      xNetForce: s.F,
      mass: s.m,
      deltaTime: s.dt,
    },
  };
}
const ENVS = SAMPLES.map((s) => [s, sampleEnv(s)]);

function close(actual, expected) {
  return (
    Number.isFinite(actual) &&
    Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected))
  );
}

// Pattern: the expression has the value expected(sample) on every sample
function formula(expected) {
  return (node) =>
    ENVS.every(([s, env]) => close(tree.evaluate(node, env), expected(s)));
}

const springForce = formula((s) => -s.k * s.x);
const netForceOverMass = formula((s) => s.F / s.m);
const potentialEnergy = formula((s) => (s.k * s.x * s.x) / 2);
const kineticEnergy = formula((s) => (s.m * s.v * s.v) / 2);
const accelerationTimesDeltaT = formula((s) => s.a * s.dt);
const velocityTimesDeltaT = formula((s) => s.v * s.dt);
const nonZeroNumber = (node) => {
  const value = tree.evaluate(node);
  return Number.isFinite(value) && value !== 0;
};
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

function isIf(block) {
  return block.name === "doIf" || block.name === "doIfElse";
}

function isStopCondition(node) {
  const c = tree.comparison(node);
  return (
    !!c &&
    tree.numberValue(c.left) === STOP_TIME &&
    p.variable(...VARIABLES.time)(c.right)
  );
}

function hasStopInBody(ifBlock) {
  return tree
    .bodies(ifBlock)
    .some((body) => body.some((b) => b.name === "stopSimulation"));
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

  // The stop if holds stop simulation or tests time > 8
  const stopIfs = stepBlocks.filter(
    (b) => isIf(b) && (hasStopInBody(b) || isStopCondition(tree.input(b, 0)))
  );

  const indexIn = (blocks, test) => blocks.findIndex(test);
  const isChangeVelocity = (b) => b.name === "changeXVelocity";
  const isChangePosition = (b) => b.name === "changePhysicsXPosition";

  const items = {
    // Physics: initialization
    initialize_spring_stiffness: inInit((b) =>
      isSetVar(b, VARIABLES.springStiffness, p.number(SPRING_STIFFNESS))
    ),
    initialize_mass: inInit((b) => isSetter(b, "setMass", p.number(MASS))),
    initialize_initial_displacement: inInit((b) =>
      isSetVar(b, VARIABLES.displacement, nonZeroNumber)
    ),
    initialize_position: inInit((b) =>
      isSetter(b, "setPhysicsXPosition", p.variable(...VARIABLES.displacement))
    ),
    initialize_velocity: inInit((b) =>
      isSetter(b, "setXVelocity", p.number(0))
    ),
    initialize_time: inInit((b) => isSetVar(b, VARIABLES.time, p.number(0))),
    initialize_deltaT: inInit((b) =>
      isSetter(b, "setDeltaTime", p.number(DELTA_T))
    ),
    initialize_net_force: inInit((b) =>
      isSetter(b, "setXNetForce", springForce)
    ),
    initialize_acceleration: inInit((b) =>
      isSetter(b, "setXAcceleration", netForceOverMass)
    ),
    initialize_potential_energy: inInit((b) =>
      isSetVar(b, VARIABLES.potentialEnergy, potentialEnergy)
    ),
    initialize_kinetic_energy: inInit((b) =>
      isSetVar(b, VARIABLES.kineticEnergy, kineticEnergy)
    ),

    // Physics: simulation step
    update_net_force: inStep((b) => isSetter(b, "setXNetForce", springForce)),
    update_acceleration: inStep((b) =>
      isSetter(b, "setXAcceleration", netForceOverMass)
    ),
    update_velocity: inStep((b) =>
      isSetter(b, "changeXVelocity", accelerationTimesDeltaT)
    ),
    update_position: inStep((b) =>
      isSetter(b, "changePhysicsXPosition", velocityTimesDeltaT)
    ),
    update_time: inStep((b) =>
      isVariableBlock(b, "doChangeVar", VARIABLES.time, p.reporter("deltaTime"))
    ),
    update_potential_energy: inStep((b) =>
      isSetVar(b, VARIABLES.potentialEnergy, potentialEnergy)
    ),
    update_kinetic_energy: inStep((b) =>
      isSetVar(b, VARIABLES.kineticEnergy, kineticEnergy)
    ),
    stop_condition: inStep((b) => isIf(b) && isStopCondition(tree.input(b, 0))),

    // Computing: initialization
    green_flag_at_top_of_initialization: flagScripts.some((body) =>
      body.some(isInitBlock)
    ),
    // k, mass and initial displacement before x position; x position before
    // net force; net force and mass before acceleration; x position and
    // velocity before the energies
    initialization_order: flagScripts.some((body) => {
      const blocks = tree.walk(body).map((entry) => entry.block);
      const at = {
        k: indexIn(blocks, (b) => isSetVar(b, VARIABLES.springStiffness)),
        mass: indexIn(blocks, (b) => b.name === "setMass"),
        dx: indexIn(blocks, (b) => isSetVar(b, VARIABLES.displacement)),
        x: indexIn(blocks, (b) => b.name === "setPhysicsXPosition"),
        v: indexIn(blocks, (b) => b.name === "setXVelocity"),
        net: indexIn(blocks, (b) => b.name === "setXNetForce"),
        acc: indexIn(blocks, (b) => b.name === "setXAcceleration"),
        pe: indexIn(blocks, (b) => isSetVar(b, VARIABLES.potentialEnergy)),
        ke: indexIn(blocks, (b) => isSetVar(b, VARIABLES.kineticEnergy)),
      };
      const required = ["k", "mass", "dx", "x", "v", "net", "pe", "ke"];
      if (required.some((key) => at[key] < 0)) return false;
      return (
        at.x > Math.max(at.k, at.mass, at.dx) &&
        at.net > at.x &&
        (at.acc < 0 || at.acc > Math.max(at.net, at.mass)) &&
        Math.min(at.pe, at.ke) > Math.max(at.x, at.v)
      );
    }),
    start_simulation_at_end: flagScripts.some(
      (body) =>
        body.length > 0 && body[body.length - 1].name === "startSimulation"
    ),

    // Computing: simulation step
    simulation_step_at_top: stepBlocks.some(
      (b) => isChangeVelocity(b) || isChangePosition(b)
    ),
    update_order_force_acceleration_velocity_position: stepScripts.some(
      (body) => {
        const net = indexIn(body, (b) => b.name === "setXNetForce");
        const acc = indexIn(body, (b) => b.name === "setXAcceleration");
        const velocity = indexIn(body, isChangeVelocity);
        const position = indexIn(body, isChangePosition);
        return net >= 0 && acc > net && velocity > acc && position > velocity;
      }
    ),
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
  id: "lesson2",
  parser: BlockParser,
  targetSprites: ["Crate"],
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
    // Only the Crate is segmented; Spring actions keep the current segment
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
