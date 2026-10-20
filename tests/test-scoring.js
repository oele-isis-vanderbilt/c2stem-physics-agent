/**
 * test-scoring.js
 *
 * Tests for the lesson scoring registry (src/services/scoring).
 *  - truck: the registry gives the same score as calling ActionScorer directly
 *  - lesson1: the expert tree scores every item; edited copies of it lose
 *    exactly the items the edit breaks
 *  - sprite filter: only the target sprite's scripts are parsed and scored
 *
 * Usage:  npm run test:scoring
 */

'use strict';

const nodepath = require('path');
const { requireService } = require('./lib/load-services');

const scoring = requireService('services/scoring/index.js');
const ActionScorer = requireService('services/ActionScorer.js');
const BlockParserV1Truck = requireService('services/BlockParser_v1_truck.js');

const FIXTURES = nodepath.join(__dirname, 'fixtures', 'block-parser');
const loadFixture = (name) => require(nodepath.join(FIXTURES, `${name}.json`));
const copy = (value) => JSON.parse(JSON.stringify(value));

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) {
    failures++;
    if (detail) console.log(detail);
  }
}

// Store with the getters the scorers and parsers read; dispatch("updateScore") is kept
function makeStore({ treeRoots = [], sprites = {}, score = {} } = {}) {
  const store = {
    state: {},
    getters: { getTreeRoots: treeRoots, getBlocks: {}, getSprites: sprites, getScore: score },
    dispatch(type, payload) {
      if (type === 'updateScore') store.getters.getScore = payload;
    },
    commit() {},
  };
  return store;
}

// ---- Tree editing helpers -------------------------------------------------

let nextId = 0;
const literal = (value) => ({
  name: String(value),
  ownerId: '',
  modifiedBefore: false,
  connectedBefore: false,
  next: { contained: [], underlay: [] },
});
const block = (name, inputs = []) => ({
  id: `test-${nextId++}`,
  name,
  ownerId: 'item_-1',
  modifiedBefore: false,
  connectedBefore: false,
  next: { contained: inputs, next: null, underlay: [] },
});

function chain(first) {
  const out = [];
  for (let node = first; node && node.id; node = node.next && node.next.next) out.push(node);
  return out;
}
function link(blocks) {
  blocks.forEach((b, i) => (b.next.next = blocks[i + 1] || null));
  return blocks[0] || null;
}
const script = (root) => chain(root.next.next);
const setScript = (root, blocks) => (root.next.next = link(blocks));
const ifBody = (ifBlock) => chain(ifBlock.next.contained[1]);
const setIfBody = (ifBlock, blocks) => (ifBlock.next.contained[1] = link(blocks));

// Cart tree of the expert, with handles to the parts the cases edit
function expert() {
  const roots = copy(loadFixture('pushcart-expert').treeRoots);
  const flag = roots.find((r) => r.name === 'receiveGo');
  const step = roots.find((r) => r.name === 'doSimulationStep');
  const ifs = script(step).filter((b) => b.name === 'doIf');
  return { roots, flag, step, releaseIf: ifs[0], stopIf: ifs[1] };
}

const isSetVar = (name) => (b) => b.name === 'doSetVar' && b.next.contained[0].name === name;

// ---- Truck ------------------------------------------------------------------

{
  const fixture = loadFixture('truck-debug');
  const truck = scoring.getLesson('truck');

  const direct = makeStore({ treeRoots: copy(fixture.treeRoots), score: truck.initialScore() });
  new ActionScorer('blocks', 'treeRoots', 'actionList', direct).updateScore(
    BlockParserV1Truck.generate(direct)
  );

  const viaRegistry = makeStore({ treeRoots: copy(fixture.treeRoots), score: truck.initialScore() });
  const ast = scoring.generateState(truck, viaRegistry);
  truck.createScorer(viaRegistry).updateScore(ast, scoring.visibleRoots(truck, viaRegistry));

  check(
    'truck: registry score equals ActionScorer score',
    JSON.stringify(viaRegistry.getters.getScore) === JSON.stringify(direct.getters.getScore),
    JSON.stringify({ direct: direct.getters.getScore, viaRegistry: viaRegistry.getters.getScore })
  );
  check('truck: AST string unchanged', ast === fixture.expected);
  check('truck: unknown lessonId falls back to truck', scoring.getLesson('nope').id === 'truck');
}

// ---- Lesson 1 ----------------------------------------------------------------

const lesson1 = scoring.getLesson('lesson1');
const ITEMS = [...lesson1.physicsItems, ...lesson1.computingItems];

// `zeros`: the items expected to score 0; every other item must score 1
function scoreCase(name, roots, zeros = []) {
  const score = lesson1.scoreTree(roots);
  const wrong = ITEMS.filter((key) => score[key] !== (zeros.includes(key) ? 0 : 1));
  check(
    `lesson1: ${name}`,
    wrong.length === 0,
    wrong.map((key) => `      ${key}: got ${score[key]}, expected ${zeros.includes(key) ? 0 : 1}`).join('\n')
  );
  return score;
}

{
  const { roots } = expert();
  const score = scoreCase('expert scores 27/27', roots);
  check(
    'lesson1: expert mastery 18 / 9 / 27',
    score.physics_mastery === 18 && score.computing_mastery === 9 && score.overall_mastery === 27,
    JSON.stringify(score)
  );
  check('lesson1: initialScore has every item at 0', ITEMS.every((k) => lesson1.initialScore()[k] === 0));
}

{
  const score = scoreCase('empty project scores 0', [], ITEMS);
  check('lesson1: empty mastery is 0', score.overall_mastery === 0);
}

scoreCase('stop if nested inside release if', copy(loadFixture('nested-if-v3').treeRoots), [
  'stop_if_at_bottom',
]);

{
  const t = expert();
  t.releaseIf.next.contained[0].next.contained[0].name = '5';
  scoreCase('release threshold 5 is outside the range', t.roots, ['release_condition']);
}

{
  const t = expert();
  t.releaseIf.next.contained[0].next.contained[0].name = '4.6';
  scoreCase('release threshold 4.6 is accepted', t.roots);
}

{
  const t = expert();
  const cond = t.releaseIf.next.contained[0]; // (4.74 < xVelocity)
  cond.name = 'reportGreaterThan';
  cond.next.contained.reverse(); // (xVelocity > 4.74)
  scoreCase('release written as x_velocity > 4.74', t.roots);
}

{
  const t = expert();
  const cond = t.stopIf.next.contained[0]; // (0 > xVelocity)
  cond.name = 'reportLessThan';
  cond.next.contained.reverse(); // (xVelocity < 0)
  scoreCase('stop written as x_velocity < 0', t.roots);
}

{
  const t = expert();
  const setNet = ifBody(t.releaseIf).find((b) => b.name === 'setXNetForce');
  const friction = setNet.next.contained[0].next.contained[1];
  setNet.next.contained[0] = block('reportProduct', [friction, literal(-1)]);
  scoreCase('release net force as friction × -1', t.roots);
}

{
  const t = expert();
  const body = ifBody(t.releaseIf);
  const setNet = body.find((b) => b.name === 'setXNetForce');
  setNet.next.contained[0].next.contained[0] = block('var: push force');
  const zeroPush = block('doSetVar', [literal('push force'), literal(0)]);
  body.splice(body.indexOf(setNet), 0, zeroPush);
  setIfBody(t.releaseIf, body);
  scoreCase('release net force as push force 0, then push − friction', t.roots);
}

{
  const t = expert();
  const setNet = ifBody(t.releaseIf).find((b) => b.name === 'setXNetForce');
  setNet.next.contained[0].next.contained[0] = block('var: push force');
  scoreCase('release net force push − friction without zeroing push', t.roots, [
    'set_net_force_in_release',
  ]);
}

{
  const t = expert();
  const body = ifBody(t.releaseIf);
  const pushing = body.find(isSetVar('pushing'));
  setIfBody(t.releaseIf, body.filter((b) => b !== pushing));
  setScript(t.step, [pushing, ...script(t.step)]);
  scoreCase('pushing = false outside the release if', t.roots, [
    'set_pushing_false_in_release',
    'updates_inside_release_if',
  ]);
}

{
  const t = expert();
  const blocks = script(t.step);
  const v = blocks.findIndex((b) => b.name === 'changeXVelocity');
  const x = blocks.findIndex((b) => b.name === 'changePhysicsXPosition');
  [blocks[v], blocks[x]] = [blocks[x], blocks[v]];
  setScript(t.step, blocks);
  scoreCase('position updated before velocity', t.roots, ['update_order_velocity_position']);
}

{
  const t = expert();
  const blocks = script(t.step);
  const release = blocks.indexOf(t.releaseIf);
  blocks.splice(release, 1);
  blocks.splice(blocks.findIndex((b) => b.name === 'doChangeVar') + 1, 0, t.releaseIf);
  setScript(t.step, blocks);
  scoreCase('release if after the updates', t.roots, ['release_if_before_updates']);
}

{
  const t = expert();
  setScript(t.flag, script(t.flag).filter((b) => b.name !== 'startSimulation'));
  scoreCase('no start simulation', t.roots, ['start_simulation_at_end']);
}

{
  const t = expert();
  const blocks = script(t.flag);
  const setNet = blocks.find((b) => b.name === 'setXNetForce');
  setScript(t.flag, [setNet, ...blocks.filter((b) => b !== setNet)]);
  scoreCase('net force set before push and friction', t.roots, ['initialization_order']);
}

{
  const t = expert();
  script(t.flag).find((b) => b.name === 'setMass').next.contained[0].name = '4';
  scoreCase('mass 4 instead of 5', t.roots, ['initialize_mass']);
}

{
  const t = expert();
  const pushingBlocks = [...script(t.flag), ...ifBody(t.releaseIf)].filter(isSetVar('pushing'));
  pushingBlocks.forEach((b) => (b.next.contained[0].name = 'is pushing?'));
  scoreCase('starter variable name "is pushing?"', t.roots);
}

{
  const t = expert();
  setIfBody(t.stopIf, []);
  scoreCase('stop if with no stop simulation', t.roots, ['stop_simulation_inside_stop_if']);
}

{
  // Init blocks without the green flag hat: loose scripts are not scored
  const t = expert();
  const loose = script(t.flag)[0];
  scoreCase(
    'initialization not under a green flag',
    t.roots.filter((r) => r !== t.flag).concat(loose),
    ITEMS.filter((k) => k.startsWith('initialize_')).concat([
      'green_flag_at_top_of_initialization',
      'initialization_order',
      'start_simulation_at_end',
    ])
  );
}

// ---- Sprite filter ---------------------------------------------------------

{
  const t = expert();
  const pusherHat = block('receiveGo');
  pusherHat.ownerId = 'item_6';
  setScript(pusherHat, [block('setPhysicsXPosition', [literal(-200)])]);
  pusherHat.next.next.ownerId = 'item_6';
  const roots = [...t.roots, pusherHat];
  const sprites = { 'item_-1': 'Cart', item_6: 'Pusher' };

  const store = makeStore({ treeRoots: roots, sprites });
  const visible = scoring.visibleRoots(lesson1, store);
  check('filter: only Cart scripts are scored', visible.length === 2 && !visible.includes(pusherHat));

  const ast = scoring.generateState(lesson1, store);
  check(
    'filter: AST string has no Pusher script',
    ast === loadFixture('pushcart-expert-v3').expected,
    ast
  );

  lesson1.createScorer(store).updateScore(ast, visible);
  check('filter: Cart + Pusher project scores 27/27', store.getters.getScore.overall_mastery === 27);

  const warn = console.warn;
  console.warn = () => {};
  const unknown = scoring.visibleRoots(lesson1, makeStore({ treeRoots: roots, sprites: {} }));
  console.warn = warn;
  check('filter: sprite map not loaded keeps every script', unknown.length === roots.length);

  check('filter: truck keeps every script', scoring.visibleRoots(scoring.getLesson('truck'), store).length === roots.length);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
