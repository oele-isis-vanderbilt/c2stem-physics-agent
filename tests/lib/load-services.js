/**
 * load-services.js
 *
 * Lets Node require() the ES-module files in src/ (which use `import` /
 * `export default` and the webpack "@/" alias) by transforming them to
 * CommonJS on the fly. Same approach as tests/test-ast-parser.js.
 *
 * Usage:
 *   const { requireService } = require('./lib/load-services');
 *   const MapBlocks = requireService('services/MapBlocks.js');
 */

'use strict';

const Module = require('module');
const nodefs = require('fs');
const nodepath = require('path');

const SRC_ROOT = nodepath.resolve(__dirname, '..', '..', 'src');

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
  if (filename.startsWith(SRC_ROOT) && !filename.includes('node_modules')) {
    mod._compile(esmToCjs(nodefs.readFileSync(filename, 'utf8'), filename), filename);
  } else {
    origLoader(mod, filename);
  }
};

function requireService(relativePath) {
  return require(nodepath.join(SRC_ROOT, relativePath));
}

module.exports = { requireService, SRC_ROOT };
