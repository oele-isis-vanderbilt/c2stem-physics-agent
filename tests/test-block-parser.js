/**
 * test-block-parser.js
 *
 * Fixture tests for the BlockParser variants. Each fixture in
 * tests/fixtures/block-parser/*.json holds a block tree (the parser's input)
 * and the expected AST string. Fixtures are saved from the AST viewer
 * (tools/ast-viewer) with "Save fixture".
 *
 * Fixture format:
 *   {
 *     "name": "pushcart-expert",
 *     "parser": "v1_truck",            // v1_truck | v1 | BlockParser | v2 | v3
 *     "sprites": { "item_-1": "Cart" }, // collabId -> sprite name
 *     "treeRoots": [ ... ],
 *     "expected": "[when greenflag clicked]\n..."
 *   }
 *
 * When a saved output is wrong, edit "expected" to the correct AST first; the
 * test then fails until the parser is fixed.
 *
 * Usage:
 *   npm run test:parser                 # all fixtures
 *   npm run test:parser -- truck        # fixtures whose name contains "truck"
 */

'use strict';

const nodefs = require('fs');
const nodepath = require('path');
const { requireService } = require('./lib/load-services');

const PARSERS = {
  v1_truck: (store) => requireService('services/BlockParser_v1_truck.js').generate(store),
  v1: (store) => requireService('services/BlockParser_v1.js').generate(store),
  BlockParser: (store) => requireService('services/BlockParser.js').generate(store),
  v2: (store) => {
    const BlockParserV2 = requireService('services/BlockParser_v2.js');
    const headers = Object.values(store.getters.getSprites).map((n) => n.toUpperCase());
    return new BlockParserV2(headers).generate(store);
  },
  v3: (store) => requireService('services/BlockParser_v3.js').generate(store),
};

const FIXTURE_DIR = nodepath.join(__dirname, 'fixtures', 'block-parser');

function loadFixtures(filter) {
  if (!nodefs.existsSync(FIXTURE_DIR)) return [];
  return nodefs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      const fixture = JSON.parse(nodefs.readFileSync(nodepath.join(FIXTURE_DIR, file), 'utf8'));
      return { file, ...fixture, name: fixture.name || nodepath.basename(file, '.json') };
    })
    .filter((f) => !filter || f.name.includes(filter) || f.file.includes(filter));
}

function makeStore(fixture) {
  return {
    state: {},
    getters: {
      getTreeRoots: fixture.treeRoots || [],
      getBlocks: {},
      getSprites: fixture.sprites || {},
    },
    dispatch() {},
    commit() {},
  };
}

// Line diff (longest common subsequence), printing only changed lines with
// their line number in the expected output.
function diffLines(expected, actual) {
  const a = expected.split('\n');
  const b = actual.split('\n');
  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push(`      + ${JSON.stringify(b[j])}   (got, near expected line ${i + 1})`);
      j++;
    } else {
      out.push(`      - ${JSON.stringify(a[i])}   (expected line ${i + 1})`);
      i++;
    }
  }
  return out.join('\n');
}

function main() {
  const filter = process.argv[2];
  const fixtures = loadFixtures(filter);
  if (fixtures.length === 0) {
    console.log(`No fixtures found in ${nodepath.relative(process.cwd(), FIXTURE_DIR)}${filter ? ` matching "${filter}"` : ''}.`);
    process.exit(1);
  }

  let failed = 0;
  for (const fixture of fixtures) {
    const generate = PARSERS[fixture.parser];
    if (!generate) {
      failed++;
      console.log(`✗ ${fixture.name}  unknown parser "${fixture.parser}" (use ${Object.keys(PARSERS).join(', ')})`);
      continue;
    }
    let actual;
    try {
      actual = generate(makeStore(fixture));
    } catch (err) {
      failed++;
      console.log(`✗ ${fixture.name}  [${fixture.parser}]  parser threw: ${err.message}`);
      continue;
    }
    if (actual === fixture.expected) {
      console.log(`✓ ${fixture.name}  [${fixture.parser}]`);
    } else {
      failed++;
      console.log(`✗ ${fixture.name}  [${fixture.parser}]`);
      console.log(diffLines(fixture.expected, actual));
    }
  }

  console.log(`\n${fixtures.length - failed}/${fixtures.length} fixtures passed`);
  process.exit(failed ? 1 : 0);
}

main();
