/**
 * test-segments.js
 *
 * Tests for TreeSegmentParser (task segments), against the segment pictures:
 *  - Lesson 1: C2STEM docs/lesson1_segment.png on the Pushcart_expert Cart tree
 *  - Lesson 2: C2STEM docs/lesson2_segmentation.png on the Springmass expert
 *    Crate tree
 *
 * Usage:  npm run test:segments
 */

'use strict';

const nodepath = require('path');
const { requireService } = require('./lib/load-services');

const TreeSegmentParser = requireService('services/TreeSegmentParser.js');

const FIXTURES = nodepath.join(__dirname, 'fixtures', 'block-parser');
const loadRoots = (name) =>
  JSON.parse(JSON.stringify(require(nodepath.join(FIXTURES, `${name}.json`)).treeRoots));

const INIT = 'initialization';
const COND = 'conditional-clause';
const UNDER = 'updating-variables-under-conditions';
const EVERY = 'updating-variables-every-sim-step';

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) {
    failures++;
    if (detail) console.log(detail);
  }
}

const makeStore = (roots, sprites = {}) => ({
  getters: { getTreeRoots: roots, getSprites: sprites },
});

// Every block (commands and reporters) in script order, with its depth
function allBlocks(roots) {
  const out = [];
  const visit = (node, depth) => {
    for (let b = node; b && b.id; b = b.next && b.next.next) {
      out.push({ block: b, depth });
      for (const input of (b.next && b.next.contained) || []) {
        if (input && input.id) visit(input, depth + 1);
      }
    }
  };
  roots.forEach((root) => visit(root, 0));
  return out;
}

function segmentsOf(roots) {
  const parser = new TreeSegmentParser(makeStore(roots));
  return allBlocks(roots).map(({ block, depth }) => ({
    label: `${'  '.repeat(depth)}${block.name}`,
    segment: parser.extractSegment({ block: block.id }),
  }));
}

function compare(name, roots, expected) {
  const got = segmentsOf(roots);
  const lines = [];
  const length = Math.max(got.length, expected.length);
  for (let i = 0; i < length; i++) {
    const g = got[i] || { label: '(missing)', segment: '' };
    const e = expected[i] || ['(missing)', ''];
    if (g.label.trim() !== e[0] || g.segment !== e[1]) {
      lines.push(`      ${g.label.padEnd(30)} got ${g.segment}, expected ${e[0]} -> ${e[1]}`);
    }
  }
  check(name, lines.length === 0, lines.join('\n'));
}

// ---- Expert tree: every block against the picture ---------------------------

compare('expert: every block in its picture segment', loadRoots('pushcart-expert'), [
  // Initializing Variables
  ['receiveGo', INIT],
  ['setMass', INIT],
  ['doSetVar', INIT],
  ['doSetVar', INIT],
  ['setDeltaTime', INIT],
  ['setPhysicsXPosition', INIT],
  ['setXVelocity', INIT],
  ['setXNetForce', INIT],
  ['reportDifference', INIT],
  ['var: push force', INIT],
  ['var: friction force', INIT],
  ['setXAcceleration', INIT],
  ['reportQuotient', INIT],
  ['xNetForce', INIT],
  ['mass', INIT],
  ['doSetVar', INIT],
  ['reportBoolean', INIT],
  ['doSetVar', INIT],
  ['startSimulation', INIT],
  // simulation step
  ['doSimulationStep', EVERY],
  // if (4.74 < x velocity): Conditional Statements
  ['doIf', COND],
  ['reportLessThan', COND],
  ['xVelocity', COND],
  // its body: Updating Variables, Under Conditions
  ['doSetVar', UNDER],
  ['reportBoolean', UNDER],
  ['setXNetForce', UNDER],
  ['reportDifference', UNDER],
  ['var: friction force', UNDER],
  ['setXAcceleration', UNDER],
  ['reportQuotient', UNDER],
  ['xNetForce', UNDER],
  ['mass', UNDER],
  // Updating Variables, Each Simulation Step
  ['changeXVelocity', EVERY],
  ['reportProduct', EVERY],
  ['xAcceleration', EVERY],
  ['deltaTime', EVERY],
  ['changePhysicsXPosition', EVERY],
  ['reportProduct', EVERY],
  ['xVelocity', EVERY],
  ['deltaTime', EVERY],
  ['doChangeVar', EVERY],
  ['deltaTime', EVERY],
  // if (0 > x velocity): Conditional Statements, stop simulation under it
  ['doIf', COND],
  ['reportGreaterThan', COND],
  ['xVelocity', COND],
  ['stopSimulation', UNDER],
]);

// ---- Nested if: the closest if decides --------------------------------------

{
  const roots = loadRoots('nested-if-v3');
  const segments = segmentsOf(roots);
  const ifs = segments.filter((s) => s.label.trim() === 'doIf');
  const stop = segments.find((s) => s.label.trim() === 'stopSimulation');
  check(
    'nested if: inner if is conditional, its body under conditions',
    ifs.length === 2 && ifs.every((s) => s.segment === COND) && stop.segment === UNDER,
    JSON.stringify(segments.filter((s) => /doIf|stopSimulation|reportGreaterThan/.test(s.label)))
  );
}

// ---- If inside initialization stays initialization ---------------------------

{
  const roots = loadRoots('pushcart-expert');
  const flag = roots.find((r) => r.name === 'receiveGo');
  const step = roots.find((r) => r.name === 'doSimulationStep');
  const stopIf = allBlocks([step]).map((e) => e.block).filter((b) => b.name === 'doIf')[1];
  // Move a copy of the stop if to the top of the green flag script
  const copy = JSON.parse(JSON.stringify(stopIf).replace(/"id":"/g, '"id":"copy-'));
  copy.next.next = flag.next.next;
  flag.next.next = copy;
  const parser = new TreeSegmentParser(makeStore(roots));
  const stopCopy = copy.next.contained[1];
  check(
    'if inside initialization stays initialization',
    parser.extractSegment({ block: copy.id }) === INIT &&
      parser.extractSegment({ block: stopCopy.id }) === INIT
  );
}

// ---- Removed and loose blocks -------------------------------------------------

{
  const roots = loadRoots('pushcart-expert');
  const step = roots.find((r) => r.name === 'doSimulationStep');
  const releaseIf = step.next.next;
  const pushing = releaseIf.next.contained[1];
  const parser = new TreeSegmentParser(makeStore(roots));

  check('removed: block found under conditions', parser.extractSegment({ block: pushing.id }) === UNDER);
  releaseIf.next.contained[1] = pushing.next.next; // remove it from the body
  parser.extractSegment({ block: step.next.next.next.next.id }); // something else in between
  check(
    'removed: block keeps its last segment',
    parser.extractSegment({ block: pushing.id }) === UNDER
  );

  roots.push({ id: 'loose-1', name: 'setMass', ownerId: 'item_-1', next: { contained: [], next: null } });
  parser.extractSegment({ block: step.id }); // current segment: every sim step
  check(
    'loose: new block keeps the current segment',
    parser.extractSegment({ block: 'loose-1' }) === EVERY
  );
  check('no block id keeps the current segment', parser.extractSegment({}) === EVERY);
}

// ---- Only the Cart is segmented -----------------------------------------------

{
  const roots = loadRoots('pushcart-expert');
  const cartStep = roots.find((r) => r.name === 'doSimulationStep');
  // Pusher: simulation step with an if whose body moves the pusher
  const pusherIf = {
    id: 'pusher-if',
    name: 'doIf',
    ownerId: 'item_6',
    next: {
      contained: [
        { name: 'true' },
        { id: 'pusher-move', name: 'setPhysicsXPosition', ownerId: 'item_6', next: { contained: [{ name: '0' }], next: null } },
      ],
      next: null,
    },
  };
  roots.push({ id: 'pusher-step', name: 'doSimulationStep', ownerId: 'item_6', next: { contained: [], next: pusherIf } });
  const sprites = { 'item_-1': 'Cart', item_6: 'Pusher' };

  const parser = new TreeSegmentParser(makeStore(roots, sprites), ['Cart']);
  parser.extractSegment({ block: cartStep.id }); // current: every sim step
  check(
    'Cart only: Pusher if keeps the current segment',
    parser.extractSegment({ block: 'pusher-if' }) === EVERY &&
      parser.extractSegment({ block: 'pusher-move' }) === EVERY
  );
  check(
    'Cart only: Cart blocks are still segmented',
    parser.extractSegment({ block: cartStep.next.next.id }) === COND
  );
  check(
    'without a sprite list the Pusher is segmented',
    new TreeSegmentParser(makeStore(roots, sprites)).extractSegment({ block: 'pusher-move' }) === UNDER
  );
}

// ---- Lesson 2: every block against lesson2_segmentation.png -------------------

const PE_KE = (first, second) => [
  ['doSetVar', null],
  ['reportQuotient', null],
  ['reportProduct', null],
  [first, null],
  ['reportPower', null],
  [second, null],
];
const inSegment = (rows, segment) => rows.map(([label]) => [label, segment]);
const netForceAndAcceleration = [
  ['setXNetForce'],
  ['reportProduct'],
  ['reportProduct'],
  ['var: spring stiffness'],
  ['physicsXPosition'],
  ['setXAcceleration'],
  ['reportQuotient'],
  ['xNetForce'],
  ['mass'],
];

compare('lesson2 expert: every block in its picture segment', loadRoots('springmass-expert-v3'), [
  // Initializing Variables
  ...inSegment(
    [
      ['receiveGo'],
      ['doSetVar'],
      ['setMass'],
      ['doSetVar'],
      ['setDeltaTime'],
      ['setPhysicsXPosition'],
      ['var: initial displacement'],
      ['setXVelocity'],
      ['doSetVar'],
      ...netForceAndAcceleration,
      ...PE_KE('var: spring stiffness', 'physicsXPosition'),
      ...PE_KE('mass', 'xVelocity'),
      ['startSimulation'],
    ],
    INIT
  ),
  // Updating Variables, Each Simulation Step
  ...inSegment(
    [
      ['doSimulationStep'],
      ...netForceAndAcceleration,
      ['changeXVelocity'],
      ['reportProduct'],
      ['xAcceleration'],
      ['deltaTime'],
      ['changePhysicsXPosition'],
      ['reportProduct'],
      ['xVelocity'],
      ['deltaTime'],
      ...PE_KE('var: spring stiffness', 'physicsXPosition'),
      ...PE_KE('mass', 'xVelocity'),
      ['doChangeVar'],
      ['deltaTime'],
    ],
    EVERY
  ),
  // if (8 < time): Conditional Statements, stop simulation under it
  ['doIf', COND],
  ['reportLessThan', COND],
  ['var: time', COND],
  ['stopSimulation', UNDER],
]);

// ---- Lesson 2: only the Crate is segmented ------------------------------------

{
  const lesson2 = requireService('services/scoring/index.js').getLesson('lesson2');
  const roots = loadRoots('springmass-expert-v3');
  const crateStep = roots.find((r) => r.name === 'doSimulationStep');
  const crateIf = allBlocks([crateStep]).map((e) => e.block).find((b) => b.name === 'doIf');
  // Spring: green flag script and a simulation step whose if body draws
  const springIf = {
    id: 'spring-if',
    name: 'doIf',
    ownerId: 'item_3',
    next: {
      contained: [
        { name: 'true' },
        { id: 'spring-draw', name: 'gotoXY', ownerId: 'item_3', next: { contained: [{ name: '0' }, { name: '0' }], next: null } },
      ],
      next: null,
    },
  };
  roots.push({ id: 'spring-flag', name: 'receiveGo', ownerId: 'item_3', next: { contained: [], next: null } });
  roots.push({ id: 'spring-step', name: 'doSimulationStep', ownerId: 'item_3', next: { contained: [], next: springIf } });
  const sprites = { 'item_-1': 'Crate', item_3: 'Spring' };

  const parser = lesson2.createSegmenter(makeStore(roots, sprites));
  parser.extractSegment({ block: crateStep.id }); // current: every sim step
  check(
    'lesson2 Crate only: Spring blocks keep the current segment',
    parser.extractSegment({ block: 'spring-flag' }) === EVERY &&
      parser.extractSegment({ block: 'spring-if' }) === EVERY &&
      parser.extractSegment({ block: 'spring-draw' }) === EVERY
  );
  check(
    'lesson2 Crate only: Crate blocks are still segmented',
    parser.extractSegment({ block: crateIf.id }) === COND &&
      parser.extractSegment({ block: crateIf.next.contained[1].id }) === UNDER
  );
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
