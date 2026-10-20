/**
 * TreeSegmentParser - the task segment of an action, from where its block
 * sits in the block tree (after ASTController has applied the action).
 *
 *   under "when green flag clicked" (an if there too)  -> initialization
 *   under "simulation step":
 *     an if block, or anything in its condition        -> conditional-clause
 *     inside an if's body                              -> updating-variables-under-conditions
 *     anything else (and the hat itself)               -> updating-variables-every-sim-step
 *
 * The closest if decides, so an if nested in a body is conditional-clause.
 * A block that is not under either hat (removed, or in a loose script) keeps
 * the segment it last had; a new loose block keeps the current segment.
 * With `spriteNames` (e.g. ["Cart"]) only those sprites' scripts are
 * segmented; actions on other sprites keep the current segment.
 *
 * Same interface as SegmentParser: extractSegment(actionRep) -> segment name.
 */
import tree from "@/services/scoring/treeUtils";

const INITIALIZATION = "initialization";
const CONDITIONAL = "conditional-clause";
const UNDER_CONDITIONS = "updating-variables-under-conditions";
const EVERY_STEP = "updating-variables-every-sim-step";

const HAT_SEGMENTS = {
  receiveGo: INITIALIZATION,
  doSimulationStep: EVERY_STEP,
};

function isIf(block) {
  return block.name === "doIf" || block.name === "doIfElse";
}

// Segment of block `id` in the chain starting at `first`, or null if not there
function findInChain(first, id, segment, seen) {
  for (let block = first; tree.isBlock(block); block = tree.nextBlock(block)) {
    if (seen.has(block.id)) return null;
    seen.add(block.id);

    const conditional = isIf(block) && segment !== INITIALIZATION;
    const here = conditional ? CONDITIONAL : segment;
    if (block.id === id) return here;

    const bodySlots = tree.bodySlots(block);
    const inputs = tree.inputs(block);
    for (let i = 0; i < inputs.length; i++) {
      if (!tree.isBlock(inputs[i])) continue;
      let inner = here;
      if (conditional && bodySlots.includes(i)) inner = UNDER_CONDITIONS;
      const found = findInChain(inputs[i], id, inner, seen);
      if (found) return found;
    }
  }
  return null;
}

function segmentOf(roots, id) {
  for (const root of roots) {
    const segment = HAT_SEGMENTS[root.name];
    if (!segment) continue;
    if (root.id === id) return segment;
    const found = findInChain(tree.nextBlock(root), id, segment, new Set());
    if (found) return found;
  }
  return null;
}

export default class TreeSegmentParser {
  constructor(store, spriteNames = null) {
    this.store = store;
    this.spriteNames = spriteNames;
    this.segment = INITIALIZATION;
    // Block id -> last segment it was found in
    this.lastSegment = {};
  }

  extractSegment(actionRep) {
    const id = actionRep && actionRep.block;
    if (!id) return this.segment;

    const roots = tree.rootsOfSprites(this.store, this.spriteNames);
    const found = segmentOf(roots, id);
    if (found) {
      this.lastSegment[id] = found;
      this.segment = found;
    } else if (this.lastSegment[id]) {
      this.segment = this.lastSegment[id];
    }
    return this.segment;
  }
}
