/**
 * AST viewer: shows the block tree and the BlockParser output live while you
 * edit a project in the physics environment.
 *
 * It runs the app's real service files (ASTController, EventXMLParser,
 * BlockParser*) unmodified, wired the same way ConstructWAgent wires them:
 * replay the project history on open, then feed every live action through
 * ASTController and regenerate the AST string.
 *
 * Run from the repo root:  python -m http.server 8010 --bind 127.0.0.1
 * Open:  http://127.0.0.1:8010/tools/ast-viewer/?user=oele&project=Pushcart_expert
 * Optional params: parser=v1_truck|v1|BlockParser|v2|v3, source=<physics server URL>,
 *   sprites=Cart[,Other]  (only these sprites' scripts reach the parser; default all)
 */
import editDistance from "edit-distance";
import ASTController from "../../src/services/ASTController.js";
import EventXMLParser from "../../src/services/EventXMLParser.js";
import ProjectXMLParser from "../../src/services/ProjectXMLParser.js";
import BlockParserV1Truck from "../../src/services/BlockParser_v1_truck.js";
import BlockParserV1 from "../../src/services/BlockParser_v1.js";
import BlockParserBase from "../../src/services/BlockParser.js";
import BlockParserV2 from "../../src/services/BlockParser_v2.js";
import BlockParserV3 from "../../src/services/BlockParser_v3.js";

window.__requireShim = { "edit-distance": editDistance };

// Keys match the fixture runner (tests/test-block-parser.js).
const PARSERS = {
  v1_truck: {
    label: "BlockParser_v1_truck (ConstructWAgent)",
    generate: (store) => BlockParserV1Truck.generate(store),
  },
  v1: {
    label: "BlockParser_v1 (BuildEnv)",
    generate: (store) => BlockParserV1.generate(store),
  },
  BlockParser: {
    label: "BlockParser",
    generate: (store) => BlockParserBase.generate(store),
  },
  v2: {
    label: "BlockParser_v2",
    generate: (store) =>
      new BlockParserV2(
        Object.values(store.getters.getSprites).map((n) => n.toUpperCase())
      ).generate(store),
  },
  v3: {
    label: "BlockParser_v3",
    generate: (store) => BlockParserV3.generate(store),
  },
};

const params = new URLSearchParams(location.search);
const config = {
  user: params.get("user") || "oele",
  project: params.get("project") || "Pushcart_expert",
  source: (params.get("source") || "https://physics.c2stem.org").replace(/\/$/, ""),
  parser: PARSERS[params.get("parser")] ? params.get("parser") : "v1_truck",
  // Sprite names to keep, or null for every sprite.
  sprites: params.get("sprites")
    ? params.get("sprites").split(",").map((s) => s.trim()).filter(Boolean)
    : null,
};

const el = {
  frame: document.getElementById("env-frame"),
  parser: document.getElementById("parser-select"),
  replay: document.getElementById("replay-btn"),
  status: document.getElementById("status-line"),
  lastAction: document.getElementById("last-action"),
  spriteBoxes: document.getElementById("sprite-checkboxes"),
  sprites: document.getElementById("sprites-line"),
  tabs: document.querySelectorAll(".tabs button"),
  output: document.getElementById("output"),
  copy: document.getElementById("copy-btn"),
  fixtureName: document.getElementById("fixture-name"),
  save: document.getElementById("save-btn"),
};

// ── State and mock store ─────────────────────────────────────────────────────
// ASTController mutates the blocks/treeRoots objects it is given, and the
// parsers read them back through store.getters, exactly as in the app.
// ASTController always sees every sprite's actions (so the tree stays
// consistent); the sprite filter only narrows what the getters hand out.
const state = {
  blocks: {},
  treeRoots: [],
  sprites: {},
  controller: null,
  replaying: false,
  actionCount: 0,
  ast: "",
  prevAst: "",
  error: null,
  tab: "ast",
};

const store = {
  state: { user: config.user },
  getters: {
    get getTreeRoots() {
      return visibleRoots();
    },
    get getBlocks() {
      return state.blocks;
    },
    get getSprites() {
      return visibleSprites();
    },
  },
  dispatch() {},
  commit() {},
};

// A script belongs to the sprite whose collabId is its root block's ownerId
// (live actions arrive with owner "<collabId>/scripts").
function isVisible(root) {
  return !config.sprites || config.sprites.includes(state.sprites[root.ownerId]);
}

function visibleRoots() {
  return state.treeRoots.filter(isVisible);
}

function visibleSprites() {
  if (!config.sprites) return state.sprites;
  return Object.fromEntries(
    Object.entries(state.sprites).filter(([, name]) => config.sprites.includes(name))
  );
}

function describeFilter() {
  const hidden = state.treeRoots.filter((r) => !isVisible(r));
  if (!config.sprites) return `${state.treeRoots.length} scripts · all sprites`;
  const bySprite = {};
  for (const root of hidden) {
    const name = state.sprites[root.ownerId] || "unknown sprite";
    bySprite[name] = (bySprite[name] || 0) + 1;
  }
  const detail = Object.entries(bySprite)
    .map(([name, n]) => `${n} ${name}`)
    .join(", ");
  const known = Object.values(state.sprites);
  const missing = known.length ? config.sprites.filter((n) => !known.includes(n)) : [];
  return (
    `${state.treeRoots.length - hidden.length} scripts shown` +
    (hidden.length ? ` · ${hidden.length} hidden (${detail})` : "") +
    (missing.length ? ` · not in project: ${missing.join(", ")}` : "")
  );
}

function renderSpriteBoxes() {
  el.spriteBoxes.replaceChildren(
    ...Object.values(state.sprites).map((name) => {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = name;
      box.checked = !config.sprites || config.sprites.includes(name);
      box.addEventListener("change", onSpriteToggle);
      const label = document.createElement("label");
      label.append(box, name);
      return label;
    })
  );
}

function onSpriteToggle() {
  const boxes = [...el.spriteBoxes.querySelectorAll("input")];
  const checked = boxes.filter((b) => b.checked).map((b) => b.value);
  config.sprites = checked.length === boxes.length ? null : checked;
  if (config.sprites) params.set("sprites", config.sprites.join(","));
  else params.delete("sprites");
  history.replaceState(null, "", `?${params}`);
  regenerate();
}

function resetTree() {
  state.blocks = {};
  state.treeRoots = [];
  state.actionCount = 0;
  state.controller = new ASTController(state.blocks, state.treeRoots, [], store);
}

// ── Rendering ────────────────────────────────────────────────────────────────
function regenerate() {
  state.prevAst = state.ast;
  try {
    state.ast = PARSERS[config.parser].generate(store);
    state.error = null;
  } catch (err) {
    state.ast = "";
    state.error = err;
    console.error("[AST viewer] Parser threw:", err);
  }
  render();
}

function render() {
  el.sprites.textContent = describeFilter();
  el.output.classList.toggle("error", Boolean(state.error));
  if (state.error) {
    el.output.textContent = `Parser error: ${state.error.message}\n\n${state.error.stack || ""}`;
    return;
  }
  if (state.tab === "ast") {
    el.output.textContent = state.ast || "(empty)";
  } else if (state.tab === "tree") {
    el.output.textContent = renderTree(visibleRoots()) || "(no blocks)";
  } else {
    el.output.innerHTML = renderDiff(state.prevAst, state.ast);
  }
}

function renderTree(roots) {
  const lines = [];
  const visit = (node, depth) => {
    if (!node) return;
    const pad = "  ".repeat(depth);
    if (node.id) {
      const owner = node.ownerId
        ? `  · ${state.sprites[node.ownerId] || node.ownerId}`
        : "";
      lines.push(`${pad}${node.id}  ${node.name}${owner}`);
    } else {
      lines.push(`${pad}${JSON.stringify(node.name)}`);
    }
    for (const child of node.next?.contained || []) visit(child, depth + 2);
    if (node.next?.next) visit(node.next.next, depth);
  };
  roots.forEach((root, i) => {
    lines.push(`ROOT ${i}`);
    visit(root, 1);
  });
  return lines.join("\n");
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// Line diff (longest common subsequence) between the previous and current AST.
function renderDiff(before, after) {
  const a = before.split("\n");
  const b = after.split("\n");
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
      out.push(`<span class="same">  ${escapeHtml(a[i])}</span>`);
      i++;
      j++;
    } else if (j < b.length && (i >= a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push(`<span class="add">+ ${escapeHtml(b[j])}</span>`);
      j++;
    } else {
      out.push(`<span class="del">- ${escapeHtml(a[i])}</span>`);
      i++;
    }
  }
  const changed = out.some((l) => !l.startsWith('<span class="same">'));
  return (changed ? "" : '<span class="muted">(no change since the previous render)</span>\n') + out.join("\n");
}

function setStatus(text) {
  el.status.textContent = text;
}

// ── Project history replay ───────────────────────────────────────────────────
async function fetchPublicXml() {
  const url =
    `${config.source}/api/RawPublic?Username=${encodeURIComponent(config.user)}` +
    `&ProjectName=${encodeURIComponent(config.project)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RawPublic returned HTTP ${res.status}`);
  return res.text();
}

async function replay() {
  if (state.replaying) return;
  state.replaying = true;
  setStatus("Replaying project history…");
  try {
    // Prefer the IDE's live copy (includes edits made in this session); fall
    // back to the saved public project if the export carries no history.
    let xml = null;
    let origin = "environment";
    try {
      xml = await api.getProjectXML();
    } catch (err) {
      console.warn("[AST viewer] getProjectXML failed:", err);
    }
    if (!xml || !xml.includes("<replay")) {
      xml = await fetchPublicXml();
      origin = "saved public project";
    }

    state.sprites = new ProjectXMLParser(xml).parse();
    renderSpriteBoxes();

    const events = EventXMLParser.parseXMLAllUsers(xml);
    resetTree();
    let failed = 0;
    for (const event of events) {
      try {
        state.controller.actionListener(event, null);
      } catch (err) {
        failed++;
        console.warn("[AST viewer] Replay event failed:", event, err);
      }
    }
    state.prevAst = "";
    state.ast = "";
    setStatus(
      `Replayed ${events.length} events from the ${origin}` +
        (failed ? ` (${failed} failed, see console)` : "") +
        ` · ${state.treeRoots.length} scripts`
    );
  } catch (err) {
    console.error("[AST viewer] Replay failed:", err);
    resetTree();
    setStatus(`Replay failed: ${err.message}. Starting from an empty tree.`);
  } finally {
    state.replaying = false;
  }
  regenerate();
}

// ── Live actions ─────────────────────────────────────────────────────────────
function onAction(action) {
  if (action.type === "openProject") {
    // The project just (re)opened: its blocks never arrive as actions.
    setTimeout(replay, 1000);
    return;
  }
  // Actions during a replay are already in the exported history.
  if (state.replaying || !state.controller) return;

  state.controller.actionListener(action, null);
  state.actionCount++;
  el.lastAction.textContent =
    `Last action: ${action.type}  ·  #${state.actionCount} live  ·  ` +
    new Date().toLocaleTimeString();
  console.debug("[AST viewer] action", action);
  regenerate();
}

// The embedded API's requests time out after 5 s if the IDE is not listening
// yet, so poll a cheap request until it answers.
async function waitForEnvironment() {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await api.getUsername();
      return;
    } catch {
      setStatus(`Waiting for the environment… (attempt ${attempt})`);
    }
  }
  throw new Error("the environment did not respond");
}

// ── Toolbar ──────────────────────────────────────────────────────────────────
for (const [key, parser] of Object.entries(PARSERS)) {
  el.parser.add(new Option(parser.label, key, false, key === config.parser));
}
el.parser.addEventListener("change", () => {
  config.parser = el.parser.value;
  params.set("parser", config.parser);
  history.replaceState(null, "", `?${params}`);
  regenerate();
});

el.tabs.forEach((tab) =>
  tab.addEventListener("click", () => {
    state.tab = tab.dataset.tab;
    el.tabs.forEach((t) => t.classList.toggle("active", t === tab));
    render();
  })
);

el.replay.addEventListener("click", replay);

el.copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(el.output.textContent);
  el.copy.textContent = "Copied";
  setTimeout(() => (el.copy.textContent = "Copy"), 1200);
});

el.fixtureName.value = config.project.replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase();
el.save.addEventListener("click", () => {
  const name = el.fixtureName.value.trim() || "fixture";
  // `expected` is the parser output at save time. If that output is wrong,
  // edit `expected` in the file to the correct AST before fixing the parser.
  // Only the filtered sprites' scripts are saved, so the runner needs no filter.
  const fixture = {
    name,
    source: { user: config.user, project: config.project },
    parser: config.parser,
    savedAt: new Date().toISOString(),
    spriteFilter: config.sprites,
    sprites: visibleSprites(),
    treeRoots: JSON.parse(JSON.stringify(visibleRoots())),
    expected: state.ast,
  };
  const blob = new Blob([JSON.stringify(fixture, null, 2) + "\n"], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${name}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

// ── Start ────────────────────────────────────────────────────────────────────
el.frame.src =
  `${config.source}/?action=present&Username=${encodeURIComponent(config.user)}` +
  `&ProjectName=${encodeURIComponent(config.project)}&noExitWarning&noRun&editMode`;
document.title = `AST Viewer · ${config.project}`;

const api = new window.EmbeddedNetsBloxAPI(el.frame);
resetTree();
regenerate();

el.frame.addEventListener("load", async () => {
  try {
    await waitForEnvironment();
    await api.addActionListener(onAction);
    setStatus("Connected. Loading project…");
    // If the project opened before our listener was registered, no
    // openProject action will arrive, so replay once now.
    await replay();
  } catch (err) {
    setStatus(`Could not connect: ${err.message}`);
    console.error("[AST viewer]", err);
  }
});
