/**
 * test-ast-parser.js
 *
 * End-to-end test for EventXMLParser.parseXMLPeerContext and the full
 * state-generation pipeline (ASTController → BlockParser_v1_truck).
 *
 * Runs standalone with Node.js — the Vue app does NOT need to be running.
 *
 * Usage (fetch project from server):
 *   node tests/test-ast-parser.js --username alice --password secret --project MyProject
 *
 * Usage (load project XML from a local file instead):
 *   node tests/test-ast-parser.js --username alice --xml ./project.xml
 *
 * Optional flags:
 *   --save-xml <path>   Save the fetched XML to a file for reuse
 *   --server <url>      NetsBlox server base URL (default: https://physics.c2stem.org)
 *
 * Install the one required extra dependency first:
 *   npm install --save-dev @xmldom/xmldom
 */

'use strict';

// ── 1. DOMParser polyfill ────────────────────────────────────────────────────
// EventXMLParser and ASTController call `new DOMParser()` (browser API).
// @xmldom/xmldom provides DOMParser but lacks querySelector/querySelectorAll.
// We wrap it with a minimal polyfill for the selectors the service files use:
//   "parsererror", "replay"           (simple tag selectors)
//   "block,custom-block"              (comma-separated tag selectors)
try {
  const { DOMParser: XmlDOMParser } = require('@xmldom/xmldom');

  function addQuerySelector(node) {
    node.querySelector = function querySelector(selector) {
      // Handle comma-separated list of simple tag-name selectors.
      for (const sel of selector.split(',').map(s => s.trim())) {
        const hits = this.getElementsByTagName(sel);
        if (hits && hits.length > 0) return hits[0];
      }
      return null;
    };
    return node;
  }

  class PatchedDOMParser {
    parseFromString(src, mime) {
      const doc = new XmlDOMParser().parseFromString(src, mime);
      return addQuerySelector(doc);
    }
  }

  global.DOMParser = PatchedDOMParser;
} catch {
  console.error(
    '[bootstrap] Missing dependency — run:  npm install --save-dev @xmldom/xmldom'
  );
  process.exit(1);
}

// ── 2. Lightweight ESM → CJS loader for src/services/*.js ───────────────────
// The service files use `import` / `export default` (ES module syntax) which
// Node's CommonJS loader can't handle natively. This patch transforms only the
// files inside src/services on-the-fly so we can require() them directly.
const Module  = require('module');
const nodefs  = require('fs');
const nodepath = require('path');

const SRC_ROOT = nodepath.resolve(__dirname, '..', 'src');

function resolveFrom(specifier, fromDir) {
  if (specifier.startsWith('@/')) {
    return nodepath.resolve(SRC_ROOT, specifier.slice(2));
  }
  if (specifier.startsWith('.')) {
    return nodepath.resolve(fromDir, specifier);
  }
  return specifier; // node_modules package – leave as-is
}

function esmToCjs(src, filename) {
  const dir = nodepath.dirname(filename);
  return src
    // import { A, B } from 'X'
    .replace(
      /^import\s*\{([^}]+)\}\s*from\s+['"](.+?)['"]\s*;?$/gm,
      (_, names, from) =>
        `const {${names}} = require(${JSON.stringify(resolveFrom(from, dir))});`
    )
    // import X from 'Y'
    .replace(
      /^import\s+([\w$]+)\s+from\s+['"](.+?)['"]\s*;?$/gm,
      (_, name, from) => {
        const req = `require(${JSON.stringify(resolveFrom(from, dir))})`;
        return `const _esm_${name} = ${req}; const ${name} = (_esm_${name} && _esm_${name}.default !== undefined) ? _esm_${name}.default : _esm_${name};`;
      }
    )
    // export default <anything>
    .replace(/^export\s+default\s+/gm, 'module.exports = ');
}

const origLoader = Module._extensions['.js'];
Module._extensions['.js'] = function patchedLoader(mod, filename) {
  const isServiceFile =
    filename.startsWith(SRC_ROOT) && !filename.includes('node_modules');
  if (isServiceFile) {
    const src = nodefs.readFileSync(filename, 'utf8');
    mod._compile(esmToCjs(src, filename), filename);
  } else {
    origLoader(mod, filename);
  }
};

// ── 3. Load the actual service files ────────────────────────────────────────
const EventXMLParser = require(nodepath.join(SRC_ROOT, 'services/EventXMLParser.js'));
const ASTController  = require(nodepath.join(SRC_ROOT, 'services/ASTController.js'));
const BlockParser    = require(nodepath.join(SRC_ROOT, 'services/BlockParser.js'));

// ── 4. CLI args ──────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
}

const username    = arg('username');
const password    = arg('password');
const projectName = arg('project');
const xmlFile     = arg('xml');
const saveXml     = arg('save-xml');
const serverBase  = arg('server') || 'https://physics.c2stem.org';

if (!username) {
  console.error('Usage: node tests/test-ast-parser.js --username <user> [--password <pass> --project <name>] [--xml <path>]');
  process.exit(1);
}
if (!xmlFile && (!password || !projectName)) {
  console.error('Provide either --xml <path>  OR  both --password <pass> and --project <name>');
  process.exit(1);
}

// ── 5. HTTP helpers ──────────────────────────────────────────────────────────
const https = require('https');
const http  = require('http');
const { URLSearchParams } = require('url');
const crypto = require('crypto');

function httpPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const u      = new URL(urlStr);
    const lib    = u.protocol === 'https:' ? https : http;
    const bodyBuf = Buffer.from(String(body));
    const req = lib.request(
      {
        hostname: u.hostname,
        port:     u.port || (u.protocol === 'https:' ? 443 : 80),
        path:     u.pathname + u.search,
        method:   'POST',
        headers:  { ...headers, 'Content-Length': bodyBuf.length },
      },
      res => {
        const chunks = [];
        res.on('data',  c => chunks.push(c));
        res.on('end',   () => resolve({
          status:  res.statusCode,
          headers: res.headers,
          body:    Buffer.concat(chunks).toString('utf8'),
        }));
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ── 6. NetsBlox login ────────────────────────────────────────────────────────
async function netsbloxLogin() {
  const hash = crypto.createHash('sha512').update(password).digest('hex');
  console.log(`[Login] Authenticating "${username}" on ${serverBase} ...`);

  const res = await httpPost(
    `${serverBase}/api`,
    { 'Content-Type': 'application/json; charset=utf-8' },
    JSON.stringify({ __u: username, __h: hash })
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Login failed (HTTP ${res.status}): ${res.body.slice(0, 300)}`);
  }
  const cookies = [].concat(res.headers['set-cookie'] || []);
  console.log(`[Login] OK — ${cookies.length} session cookie(s) received`);
  return cookies;
}

// ── 7. Fetch project XML ─────────────────────────────────────────────────────
async function fetchProjectXML(cookies) {
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  const body = new URLSearchParams({ owner: username, projectName }).toString();

  console.log(`[Fetch] Requesting project "${projectName}" (owner: ${username}) ...`);
  const res = await httpPost(
    `${serverBase}/api/getProjectByName`,
    { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader },
    body
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Project fetch failed (HTTP ${res.status}): ${res.body.slice(0, 300)}`);
  }

  const raw = res.body;
  if (raw.trimStart().startsWith('<')) return raw;

  const params = new URLSearchParams(raw);
  for (const value of params.values()) {
    if (value.trimStart().startsWith('<')) return value;
  }
  throw new Error('Response did not contain any XML field');
}

// ── 8. Mock store ────────────────────────────────────────────────────────────
// ASTController writes to blocks/treeRoots directly (mutates the objects passed
// in the constructor). BlockParser reads treeRoots from store.getters.getTreeRoots.
function makeMockStore(blocks, treeRoots) {
  return {
    state:   { user: username },
    getters: { getBlocks: blocks, getTreeRoots: treeRoots, getSprites: {} },
    commit() {},
    dispatch() {},
  };
}

// ── 9. Main ──────────────────────────────────────────────────────────────────
(async () => {
  try {
    // ─── Step A: get the XML ─────────────────────────────────────────────────
    let xmlString;
    if (xmlFile) {
      console.log(`[XML] Loading from file: ${xmlFile}`);
      xmlString = nodefs.readFileSync(nodepath.resolve(xmlFile), 'utf8');
      console.log(`[XML] File size: ${xmlString.length} characters`);
    } else {
      const cookies = await netsbloxLogin();
      xmlString = await fetchProjectXML(cookies);
      console.log(`[XML] Received ${xmlString.length} characters`);
    }

    if (saveXml) {
      nodefs.writeFileSync(nodepath.resolve(saveXml), xmlString, 'utf8');
      console.log(`[XML] Saved to ${saveXml}`);
    }

    // ─── Step B: parseXMLAllUsers ────────────────────────────────────────────
    // Reconstruct the full block tree from every user's events so no hat block
    // or body block is missing due to username filtering.
    console.log(`\n${'─'.repeat(60)}`);
    console.log('EventXMLParser.parseXMLAllUsers  (all users)');
    console.log('─'.repeat(60));

    const events = EventXMLParser.parseXMLAllUsers(xmlString, username);
    console.log(`Result: ${events.length} event(s)`);

    if (events.length === 0) {
      console.log('No events found for this username — pipeline ends here.');
      return;
    }

    // Print a sample of events so you can verify the parsing output
    const SAMPLE = Math.min(10, events.length);
    console.log(`\nFirst ${SAMPLE} events:`);
    events.slice(0, SAMPLE).forEach((e, i) => {
      const argsPreview = JSON.stringify(e.args).slice(0, 80);
      console.log(`  [${String(i).padStart(3)}] id=${String(e.id).padStart(6)}  type=${e.type.padEnd(20)}  username=${e.username}  args=${argsPreview}`);
    });
    if (events.length > SAMPLE) {
      console.log(`  ... and ${events.length - SAMPLE} more`);
    }

    // ─── Step C: replay through ASTController ────────────────────────────────
    console.log(`\n${'─'.repeat(60)}`);
    console.log('ASTController.actionListener  (replay all events)');
    console.log('─'.repeat(60));

    const blocks    = {};
    const treeRoots = [];
    const controller = new ASTController(
      blocks,
      treeRoots,
      [],
      makeMockStore(blocks, treeRoots)
    );

    let okCount = 0, errCount = 0;
    for (const event of events) {
      try {
        controller.actionListener(event, null);
        okCount++;
      } catch (err) {
        errCount++;
        if (errCount <= 5) {
          console.warn(`  [WARN] id=${event.id} type=${event.type}: ${err.message}`);
        }
      }
    }

    console.log(`Replay complete — ${okCount} ok, ${errCount} error(s)`);
    console.log(`Tree roots: ${treeRoots.length}  |  Blocks in map: ${Object.keys(blocks).length}`);

    // ─── Step C.5: debug — dump every tree root ──────────────────────────────
    console.log(`\n${'─'.repeat(60)}`);
    console.log('Tree root block names (raw → MapBlocks spec)');
    console.log('─'.repeat(60));
    const MapBlocks = require(nodepath.join(SRC_ROOT, 'services/MapBlocks.js'));
    treeRoots.forEach((root, i) => {
      const spec = MapBlocks.get(root.name) || '(no mapping)';
      const childCount = root.next
        ? (root.next.contained || []).length + (root.next.next ? 1 : 0)
        : 0;
      console.log(`  [${i}] name="${root.name}"  id="${root.id}"  spec="${spec}"  direct-children=${childCount}`);
    });

    // ─── Step D: generate state string ───────────────────────────────────────
    console.log(`\n${'─'.repeat(60)}`);
    console.log('BlockParser_v1_truck.generate');
    console.log('─'.repeat(60));

    const mockStore = makeMockStore(blocks, treeRoots);
    const state = BlockParser.generate(mockStore);

    if (!state || state.trim().length === 0) {
      console.log('(empty — no connected scripts found in the replayed tree)');
    } else {
      console.log('\nGenerated state:\n');
      console.log(state);
    }

    console.log(`\n${'─'.repeat(60)}`);
    console.log('Done.');

  } catch (err) {
    console.error(`\n[ERROR] ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
})();
