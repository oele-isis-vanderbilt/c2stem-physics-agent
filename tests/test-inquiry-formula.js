/**
 * test-inquiry-formula.js
 *
 * Tests for src/inquiry/formula.js: formulas for calculated lesson variables.
 * The same cases are checked by the inquiry service's validator
 * (tests/test_validation.py there), which shares the grammar.
 *
 * Usage:  npm run test:formula
 */

'use strict';

const nodefs = require('fs');
const nodeos = require('os');
const nodepath = require('path');
const { pathToFileURL } = require('url');

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log('   got:', detail);
  }
}

async function load() {
  // formula.js is an ES module with no imports; load a copy as .mjs
  const src = nodepath.resolve(__dirname, '..', 'src', 'inquiry', 'formula.js');
  const dir = nodefs.mkdtempSync(nodepath.join(nodeos.tmpdir(), 'inquiry-formula-'));
  const copy = nodepath.join(dir, 'formula.mjs');
  nodefs.copyFileSync(src, copy);
  try {
    return await import(pathToFileURL(copy).href);
  } finally {
    nodefs.rmSync(dir, { recursive: true, force: true });
  }
}

(async () => {
  const f = await load();
  const values = { massRatio: 3, velocityRatio: 2, m: 2, v: '4' };

  // working out
  const cases = [
    ['1', 1],
    ['massRatio', 3],
    ['10 * velocityRatio', 20],
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['2 ^ 3 ^ 2', 512], // power is right-associative
    ['-2 ^ 2', -4], // as in maths: -(2 ^ 2)
    ['2 ^ -1', 0.5],
    ['3 * -2', -6],
    ['10 - 4 - 3', 3],
    ['12 / 3 / 2', 2],
    ['0.5 * m * v ^ 2', 16], // string slider values are read as numbers
    ['.5 * 4', 2],
    ['-(massRatio - 5)', 2],
  ];
  for (const [formula, expected] of cases) {
    const got = f.calculate(formula, values);
    check(`${formula} = ${expected}`, got === expected, got);
  }
  check('dividing by zero gives null', f.calculate('1 / (massRatio - 3)', values) === null);
  check('a missing value gives null', f.calculate('2 * missing', values) === null);
  check('an unreadable formula gives null', f.calculate('2 *', values) === null);

  // errors authors see
  const bad = {
    '': 'Give a formula',
    '   ': 'Give a formula',
    '2 *': 'ends too soon',
    '(2 + 3': 'not closed',
    '2 3': 'wrong place',
    '2 + 3)': 'wrong place',
    'a % b': "can't be used",
    'eval("x")': "can't be used",
  };
  for (const [formula, words] of Object.entries(bad)) {
    let message = '';
    try {
      f.parseFormula(formula);
    } catch (e) {
      message = e instanceof f.FormulaError ? e.message : `not a FormulaError: ${e}`;
    }
    check(`"${formula}" is rejected (${words})`, message.includes(words), message);
  }

  // names and checking against sliders
  const names = f.namesIn(f.parseFormula('0.5 * m * v ^ 2 + m'));
  check('names are listed once, in order', JSON.stringify(names) === '["m","v"]', names);
  const sliders = [{ key: 'massRatio' }, { key: 'velocityRatio' }];
  const ok = f.checkFormula('10 * velocityRatio', sliders);
  check('a formula using sliders is fine', ok.ok && ok.names[0] === 'velocityRatio', ok);
  const typo = f.checkFormula('10 * velocityRatoi', sliders);
  check(
    'a typo names the sliders you can use',
    !typo.ok && typo.message.includes('velocityRatoi') && typo.message.includes('massRatio, velocityRatio'),
    typo.message
  );
  const broken = f.checkFormula('10 *', sliders);
  check('a broken formula says why', !broken.ok && broken.message.includes('ends too soon'), broken.message);

  // renaming a slider inside formulas
  check(
    'renaming replaces whole names only',
    f.renameInFormula('mass * massRatio + mass2 - (mass)', 'mass', 'cartMass') ===
      'cartMass * massRatio + mass2 - (cartMass)',
    f.renameInFormula('mass * massRatio + mass2 - (mass)', 'mass', 'cartMass')
  );

  console.log(failures ? `\n${failures} failed` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})();
