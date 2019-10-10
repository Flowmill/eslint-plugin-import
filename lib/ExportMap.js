'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.recursivePatternCapture = recursivePatternCapture;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _doctrine = require('doctrine');

var _doctrine2 = _interopRequireDefault(_doctrine);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _eslint = require('eslint');

var _parse = require('eslint-module-utils/parse');

var _parse2 = _interopRequireDefault(_parse);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _ignore = require('eslint-module-utils/ignore');

var _ignore2 = _interopRequireDefault(_ignore);

var _hash = require('eslint-module-utils/hash');

var _unambiguous = require('eslint-module-utils/unambiguous');

var unambiguous = _interopRequireWildcard(_unambiguous);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = (0, _debug2.default)('eslint-plugin-import:ExportMap');

const exportCache = new Map();

class ExportMap {
  constructor(path) {
    this.path = path;
    this.namespace = new Map();
    // todo: restructure to key on path, value is resolver + map of names
    this.reexports = new Map();
    /**
     * star-exports
     * @type {Set} of () => ExportMap
     */
    this.dependencies = new Set();
    /**
     * dependencies of this module that are not explicitly re-exported
     * @type {Map} from path = () => ExportMap
     */
    this.imports = new Map();
    this.errors = [];
  }

  get hasDefault() {
    return this.get('default') != null;
  } // stronger than this.has

  get size() {
    let size = this.namespace.size + this.reexports.size;
    this.dependencies.forEach(dep => {
      const d = dep();
      // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;
      size += d.size;
    });
    return size;
  }

  /**
   * Note that this does not check explicitly re-exported names for existence
   * in the base namespace, but it will expand all `export * from '...'` exports
   * if not found in the explicit namespace.
   * @param  {string}  name
   * @return {Boolean} true if `name` is exported by this module.
   */
  has(name) {
    if (this.namespace.has(name)) return true;
    if (this.reexports.has(name)) return true;

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();

        // todo: report as unresolved?
        if (!innerMap) continue;

        if (innerMap.has(name)) return true;
      }
    }

    return false;
  }

  /**
   * ensure that imported name fully resolves.
   * @param  {[type]}  name [description]
   * @return {Boolean}      [description]
   */
  hasDeep(name) {
    if (this.namespace.has(name)) return { found: true, path: [this] };

    if (this.reexports.has(name)) {
      const reexports = this.reexports.get(name),
            imported = reexports.getImport();

      // if import is ignored, return explicit 'null'
      if (imported == null) return { found: true, path: [this]

        // safeguard against cycles, only if name matches
      };if (imported.path === this.path && reexports.local === name) {
        return { found: false, path: [this] };
      }

      const deep = imported.hasDeep(reexports.local);
      deep.path.unshift(this);

      return deep;
    }

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();
        // todo: report as unresolved?
        if (!innerMap) continue;

        // safeguard against cycles
        if (innerMap.path === this.path) continue;

        let innerValue = innerMap.hasDeep(name);
        if (innerValue.found) {
          innerValue.path.unshift(this);
          return innerValue;
        }
      }
    }

    return { found: false, path: [this] };
  }

  get(name) {
    if (this.namespace.has(name)) return this.namespace.get(name);

    if (this.reexports.has(name)) {
      const reexports = this.reexports.get(name),
            imported = reexports.getImport();

      // if import is ignored, return explicit 'null'
      if (imported == null) return null;

      // safeguard against cycles, only if name matches
      if (imported.path === this.path && reexports.local === name) return undefined;

      return imported.get(reexports.local);
    }

    // default exports must be explicitly re-exported (#328)
    if (name !== 'default') {
      for (let dep of this.dependencies) {
        let innerMap = dep();
        // todo: report as unresolved?
        if (!innerMap) continue;

        // safeguard against cycles
        if (innerMap.path === this.path) continue;

        let innerValue = innerMap.get(name);
        if (innerValue !== undefined) return innerValue;
      }
    }

    return undefined;
  }

  forEach(callback, thisArg) {
    this.namespace.forEach((v, n) => callback.call(thisArg, v, n, this));

    this.reexports.forEach((reexports, name) => {
      const reexported = reexports.getImport();
      // can't look up meta for ignored re-exports (#348)
      callback.call(thisArg, reexported && reexported.get(reexports.local), name, this);
    });

    this.dependencies.forEach(dep => {
      const d = dep();
      // CJS / ignored dependencies won't exist (#717)
      if (d == null) return;

      d.forEach((v, n) => n !== 'default' && callback.call(thisArg, v, n, this));
    });
  }

  // todo: keys, values, entries?

  reportErrors(context, declaration) {
    context.report({
      node: declaration.source,
      message: `Parse errors in imported module '${declaration.source.value}': ` + `${this.errors.map(e => `${e.message} (${e.lineNumber}:${e.column})`).join(', ')}`
    });
  }
}

exports.default = ExportMap; /**
                              * parse docs from the first node that has leading comments
                              */

function captureDoc(source, docStyleParsers) {
  const metadata = {};

  // 'some' short-circuits on first 'true'

  for (var _len = arguments.length, nodes = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    nodes[_key - 2] = arguments[_key];
  }

  nodes.some(n => {
    try {

      let leadingComments;

      // n.leadingComments is legacy `attachComments` behavior
      if ('leadingComments' in n) {
        leadingComments = n.leadingComments;
      } else if (n.range) {
        leadingComments = source.getCommentsBefore(n);
      }

      if (!leadingComments || leadingComments.length === 0) return false;

      for (let name in docStyleParsers) {
        const doc = docStyleParsers[name](leadingComments);
        if (doc) {
          metadata.doc = doc;
        }
      }

      return true;
    } catch (err) {
      return false;
    }
  });

  return metadata;
}

const availableDocStyleParsers = {
  jsdoc: captureJsDoc,
  tomdoc: captureTomDoc

  /**
   * parse JSDoc from leading comments
   * @param  {...[type]} comments [description]
   * @return {{doc: object}}
   */
};function captureJsDoc(comments) {
  let doc;

  // capture XSDoc
  comments.forEach(comment => {
    // skip non-block comments
    if (comment.type !== 'Block') return;
    try {
      doc = _doctrine2.default.parse(comment.value, { unwrap: true });
    } catch (err) {
      /* don't care, for now? maybe add to `errors?` */
    }
  });

  return doc;
}

/**
  * parse TomDoc section from comments
  */
function captureTomDoc(comments) {
  // collect lines up to first paragraph break
  const lines = [];
  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    if (comment.value.match(/^\s*$/)) break;
    lines.push(comment.value.trim());
  }

  // return doctrine-like object
  const statusMatch = lines.join(' ').match(/^(Public|Internal|Deprecated):\s*(.+)/);
  if (statusMatch) {
    return {
      description: statusMatch[2],
      tags: [{
        title: statusMatch[1].toLowerCase(),
        description: statusMatch[2]
      }]
    };
  }
}

ExportMap.get = function (source, context) {
  const path = (0, _resolve2.default)(source, context);
  if (path == null) return null;

  return ExportMap.for(childContext(path, context));
};

ExportMap.for = function (context) {
  const path = context.path;


  const cacheKey = (0, _hash.hashObject)(context).digest('hex');
  let exportMap = exportCache.get(cacheKey);

  // return cached ignore
  if (exportMap === null) return null;

  const stats = _fs2.default.statSync(path);
  if (exportMap != null) {
    // date equality check
    if (exportMap.mtime - stats.mtime === 0) {
      return exportMap;
    }
    // future: check content equality?
  }

  // check valid extensions first
  if (!(0, _ignore.hasValidExtension)(path, context)) {
    exportCache.set(cacheKey, null);
    return null;
  }

  const content = _fs2.default.readFileSync(path, { encoding: 'utf8' });

  // check for and cache ignore
  if ((0, _ignore2.default)(path, context) || !unambiguous.test(content)) {
    log('ignored path due to unambiguous regex or ignore settings:', path);
    exportCache.set(cacheKey, null);
    return null;
  }

  log('cache miss', cacheKey, 'for path', path);
  exportMap = ExportMap.parse(path, content, context);

  // ambiguous modules return null
  if (exportMap == null) return null;

  exportMap.mtime = stats.mtime;

  exportCache.set(cacheKey, exportMap);
  return exportMap;
};

ExportMap.parse = function (path, content, context) {
  var m = new ExportMap(path);

  try {
    var ast = (0, _parse2.default)(path, content, context);
  } catch (err) {
    log('parse error:', path, err);
    m.errors.push(err);
    return m; // can't continue
  }

  if (!unambiguous.isModule(ast)) return null;

  const docstyle = context.settings && context.settings['import/docstyle'] || ['jsdoc'];
  const docStyleParsers = {};
  docstyle.forEach(style => {
    docStyleParsers[style] = availableDocStyleParsers[style];
  });

  // attempt to collect module doc
  if (ast.comments) {
    ast.comments.some(c => {
      if (c.type !== 'Block') return false;
      try {
        const doc = _doctrine2.default.parse(c.value, { unwrap: true });
        if (doc.tags.some(t => t.title === 'module')) {
          m.doc = doc;
          return true;
        }
      } catch (err) {/* ignore */}
      return false;
    });
  }

  const namespaces = new Map();

  function remotePath(value) {
    return _resolve2.default.relative(value, path, context.settings);
  }

  function resolveImport(value) {
    const rp = remotePath(value);
    if (rp == null) return null;
    return ExportMap.for(childContext(rp, context));
  }

  function getNamespace(identifier) {
    if (!namespaces.has(identifier.name)) return;

    return function () {
      return resolveImport(namespaces.get(identifier.name));
    };
  }

  function addNamespace(object, identifier) {
    const nsfn = getNamespace(identifier);
    if (nsfn) {
      Object.defineProperty(object, 'namespace', { get: nsfn });
    }

    return object;
  }

  function captureDependency(declaration) {
    if (declaration.source == null) return null;
    const importedSpecifiers = new Set();
    const supportedTypes = new Set(['ImportDefaultSpecifier', 'ImportNamespaceSpecifier']);
    if (declaration.specifiers) {
      declaration.specifiers.forEach(specifier => {
        if (supportedTypes.has(specifier.type)) {
          importedSpecifiers.add(specifier.type);
        }
        if (specifier.type === 'ImportSpecifier') {
          importedSpecifiers.add(specifier.imported.name);
        }
      });
    }

    const p = remotePath(declaration.source.value);
    if (p == null) return null;
    const existing = m.imports.get(p);
    if (existing != null) return existing.getter;

    const getter = thunkFor(p, context);
    m.imports.set(p, {
      getter,
      source: { // capturing actual node reference holds full AST in memory!
        value: declaration.source.value,
        loc: declaration.source.loc
      },
      importedSpecifiers
    });
    return getter;
  }

  const source = makeSourceCode(content, ast);

  ast.body.forEach(function (n) {

    if (n.type === 'ExportDefaultDeclaration') {
      const exportMeta = captureDoc(source, docStyleParsers, n);
      if (n.declaration.type === 'Identifier') {
        addNamespace(exportMeta, n.declaration);
      }
      m.namespace.set('default', exportMeta);
      return;
    }

    if (n.type === 'ExportAllDeclaration') {
      const getter = captureDependency(n);
      if (getter) m.dependencies.add(getter);
      return;
    }

    // capture namespaces in case of later export
    if (n.type === 'ImportDeclaration') {
      captureDependency(n);
      let ns;
      if (n.specifiers.some(s => s.type === 'ImportNamespaceSpecifier' && (ns = s))) {
        namespaces.set(ns.local.name, n.source.value);
      }
      return;
    }

    if (n.type === 'ExportNamedDeclaration') {
      // capture declaration
      if (n.declaration != null) {
        switch (n.declaration.type) {
          case 'FunctionDeclaration':
          case 'ClassDeclaration':
          case 'TypeAlias': // flowtype with babel-eslint parser
          case 'InterfaceDeclaration':
          case 'DeclareFunction':
          case 'TSDeclareFunction':
          case 'TSEnumDeclaration':
          case 'TSTypeAliasDeclaration':
          case 'TSInterfaceDeclaration':
          case 'TSAbstractClassDeclaration':
          case 'TSModuleDeclaration':
            m.namespace.set(n.declaration.id.name, captureDoc(source, docStyleParsers, n));
            break;
          case 'VariableDeclaration':
            n.declaration.declarations.forEach(d => recursivePatternCapture(d.id, id => m.namespace.set(id.name, captureDoc(source, docStyleParsers, d, n))));
            break;
        }
      }

      const nsource = n.source && n.source.value;
      n.specifiers.forEach(s => {
        const exportMeta = {};
        let local;

        switch (s.type) {
          case 'ExportDefaultSpecifier':
            if (!n.source) return;
            local = 'default';
            break;
          case 'ExportNamespaceSpecifier':
            m.namespace.set(s.exported.name, Object.defineProperty(exportMeta, 'namespace', {
              get() {
                return resolveImport(nsource);
              }
            }));
            return;
          case 'ExportSpecifier':
            if (!n.source) {
              m.namespace.set(s.exported.name, addNamespace(exportMeta, s.local));
              return;
            }
          // else falls through
          default:
            local = s.local.name;
            break;
        }

        // todo: JSDoc
        m.reexports.set(s.exported.name, { local, getImport: () => resolveImport(nsource) });
      });
    }

    // This doesn't declare anything, but changes what's being exported.
    if (n.type === 'TSExportAssignment') {
      const moduleDecls = ast.body.filter(bodyNode => bodyNode.type === 'TSModuleDeclaration' && bodyNode.id.name === n.expression.name);
      moduleDecls.forEach(moduleDecl => {
        if (moduleDecl && moduleDecl.body && moduleDecl.body.body) {
          moduleDecl.body.body.forEach(moduleBlockNode => {
            // Export-assignment exports all members in the namespace, explicitly exported or not.
            const exportedDecl = moduleBlockNode.type === 'ExportNamedDeclaration' ? moduleBlockNode.declaration : moduleBlockNode;

            if (exportedDecl.type === 'VariableDeclaration') {
              exportedDecl.declarations.forEach(decl => recursivePatternCapture(decl.id, id => m.namespace.set(id.name, captureDoc(source, docStyleParsers, decl, exportedDecl, moduleBlockNode))));
            } else {
              m.namespace.set(exportedDecl.id.name, captureDoc(source, docStyleParsers, moduleBlockNode));
            }
          });
        }
      });
    }
  });

  return m;
};

/**
 * The creation of this closure is isolated from other scopes
 * to avoid over-retention of unrelated variables, which has
 * caused memory leaks. See #1266.
 */
function thunkFor(p, context) {
  return () => ExportMap.for(childContext(p, context));
}

/**
 * Traverse a pattern/identifier node, calling 'callback'
 * for each leaf identifier.
 * @param  {node}   pattern
 * @param  {Function} callback
 * @return {void}
 */
function recursivePatternCapture(pattern, callback) {
  switch (pattern.type) {
    case 'Identifier':
      // base case
      callback(pattern);
      break;

    case 'ObjectPattern':
      pattern.properties.forEach(p => {
        recursivePatternCapture(p.value, callback);
      });
      break;

    case 'ArrayPattern':
      pattern.elements.forEach(element => {
        if (element == null) return;
        recursivePatternCapture(element, callback);
      });
      break;

    case 'AssignmentPattern':
      callback(pattern.left);
      break;
  }
}

/**
 * don't hold full context object in memory, just grab what we need.
 */
function childContext(path, context) {
  const settings = context.settings,
        parserOptions = context.parserOptions,
        parserPath = context.parserPath;

  return {
    settings,
    parserOptions,
    parserPath,
    path
  };
}

/**
 * sometimes legacy support isn't _that_ hard... right?
 */
function makeSourceCode(text, ast) {
  if (_eslint.SourceCode.length > 1) {
    // ESLint 3
    return new _eslint.SourceCode(text, ast);
  } else {
    // ESLint 4, 5
    return new _eslint.SourceCode({ text, ast });
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9FeHBvcnRNYXAuanMiXSwibmFtZXMiOlsicmVjdXJzaXZlUGF0dGVybkNhcHR1cmUiLCJ1bmFtYmlndW91cyIsImxvZyIsImV4cG9ydENhY2hlIiwiTWFwIiwiRXhwb3J0TWFwIiwiY29uc3RydWN0b3IiLCJwYXRoIiwibmFtZXNwYWNlIiwicmVleHBvcnRzIiwiZGVwZW5kZW5jaWVzIiwiU2V0IiwiaW1wb3J0cyIsImVycm9ycyIsImhhc0RlZmF1bHQiLCJnZXQiLCJzaXplIiwiZm9yRWFjaCIsImRlcCIsImQiLCJoYXMiLCJuYW1lIiwiaW5uZXJNYXAiLCJoYXNEZWVwIiwiZm91bmQiLCJpbXBvcnRlZCIsImdldEltcG9ydCIsImxvY2FsIiwiZGVlcCIsInVuc2hpZnQiLCJpbm5lclZhbHVlIiwidW5kZWZpbmVkIiwiY2FsbGJhY2siLCJ0aGlzQXJnIiwidiIsIm4iLCJjYWxsIiwicmVleHBvcnRlZCIsInJlcG9ydEVycm9ycyIsImNvbnRleHQiLCJkZWNsYXJhdGlvbiIsInJlcG9ydCIsIm5vZGUiLCJzb3VyY2UiLCJtZXNzYWdlIiwidmFsdWUiLCJtYXAiLCJlIiwibGluZU51bWJlciIsImNvbHVtbiIsImpvaW4iLCJjYXB0dXJlRG9jIiwiZG9jU3R5bGVQYXJzZXJzIiwibWV0YWRhdGEiLCJub2RlcyIsInNvbWUiLCJsZWFkaW5nQ29tbWVudHMiLCJyYW5nZSIsImdldENvbW1lbnRzQmVmb3JlIiwibGVuZ3RoIiwiZG9jIiwiZXJyIiwiYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzIiwianNkb2MiLCJjYXB0dXJlSnNEb2MiLCJ0b21kb2MiLCJjYXB0dXJlVG9tRG9jIiwiY29tbWVudHMiLCJjb21tZW50IiwidHlwZSIsImRvY3RyaW5lIiwicGFyc2UiLCJ1bndyYXAiLCJsaW5lcyIsImkiLCJtYXRjaCIsInB1c2giLCJ0cmltIiwic3RhdHVzTWF0Y2giLCJkZXNjcmlwdGlvbiIsInRhZ3MiLCJ0aXRsZSIsInRvTG93ZXJDYXNlIiwiZm9yIiwiY2hpbGRDb250ZXh0IiwiY2FjaGVLZXkiLCJkaWdlc3QiLCJleHBvcnRNYXAiLCJzdGF0cyIsImZzIiwic3RhdFN5bmMiLCJtdGltZSIsInNldCIsImNvbnRlbnQiLCJyZWFkRmlsZVN5bmMiLCJlbmNvZGluZyIsInRlc3QiLCJtIiwiYXN0IiwiaXNNb2R1bGUiLCJkb2NzdHlsZSIsInNldHRpbmdzIiwic3R5bGUiLCJjIiwidCIsIm5hbWVzcGFjZXMiLCJyZW1vdGVQYXRoIiwicmVzb2x2ZSIsInJlbGF0aXZlIiwicmVzb2x2ZUltcG9ydCIsInJwIiwiZ2V0TmFtZXNwYWNlIiwiaWRlbnRpZmllciIsImFkZE5hbWVzcGFjZSIsIm9iamVjdCIsIm5zZm4iLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImNhcHR1cmVEZXBlbmRlbmN5IiwiaW1wb3J0ZWRTcGVjaWZpZXJzIiwic3VwcG9ydGVkVHlwZXMiLCJzcGVjaWZpZXJzIiwic3BlY2lmaWVyIiwiYWRkIiwicCIsImV4aXN0aW5nIiwiZ2V0dGVyIiwidGh1bmtGb3IiLCJsb2MiLCJtYWtlU291cmNlQ29kZSIsImJvZHkiLCJleHBvcnRNZXRhIiwibnMiLCJzIiwiaWQiLCJkZWNsYXJhdGlvbnMiLCJuc291cmNlIiwiZXhwb3J0ZWQiLCJtb2R1bGVEZWNscyIsImZpbHRlciIsImJvZHlOb2RlIiwiZXhwcmVzc2lvbiIsIm1vZHVsZURlY2wiLCJtb2R1bGVCbG9ja05vZGUiLCJleHBvcnRlZERlY2wiLCJkZWNsIiwicGF0dGVybiIsInByb3BlcnRpZXMiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJsZWZ0IiwicGFyc2VyT3B0aW9ucyIsInBhcnNlclBhdGgiLCJ0ZXh0IiwiU291cmNlQ29kZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7UUFxakJnQkEsdUIsR0FBQUEsdUI7O0FBcmpCaEI7Ozs7QUFFQTs7OztBQUVBOzs7O0FBRUE7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBRUE7O0FBQ0E7O0lBQVlDLFc7Ozs7OztBQUVaLE1BQU1DLE1BQU0scUJB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O0FBRW5DLFNBQU87QUFDTG5ELFlBREs7QUFFTGtELGlCQUZLO0FBR0xDLGNBSEs7QUFJTGpKO0FBSkssR0FBUDtBQU1EOztBQUdEOzs7QUFHQSxTQUFTMEgsY0FBVCxDQUF3QndCLElBQXhCLEVBQThCdkQsR0FBOUIsRUFBbUM7QUFDakMsTUFBSXdELG1CQUFXL0YsTUFBWCxHQUFvQixDQUF4QixFQUEyQjtBQUN6QjtBQUNBLFdBQU8sSUFBSStGLGtCQUFKLENBQWVELElBQWYsRUFBcUJ2RCxHQUFyQixDQUFQO0FBQ0QsR0FIRCxNQUdPO0FBQ0w7QUFDQSxXQUFPLElBQUl3RCxrQkFBSixDQUFlLEVBQUVELElBQUYsRUFBUXZELEdBQVIsRUFBZixDQUFQO0FBQ0Q7QUFDRiIsImZpbGUiOiJFeHBvcnRNYXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgZnJvbSAnZnMnXG5cbmltcG9ydCBkb2N0cmluZSBmcm9tICdkb2N0cmluZSdcblxuaW1wb3J0IGRlYnVnIGZyb20gJ2RlYnVnJ1xuXG5pbXBvcnQgeyBTb3VyY2VDb2RlIH0gZnJvbSAnZXNsaW50J1xuXG5pbXBvcnQgcGFyc2UgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9wYXJzZSdcbmltcG9ydCByZXNvbHZlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSdcbmltcG9ydCBpc0lnbm9yZWQsIHsgaGFzVmFsaWRFeHRlbnNpb24gfSBmcm9tICdlc2xpbnQtbW9kdWxlLXV0aWxzL2lnbm9yZSdcblxuaW1wb3J0IHsgaGFzaE9iamVjdCB9IGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvaGFzaCdcbmltcG9ydCAqIGFzIHVuYW1iaWd1b3VzIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvdW5hbWJpZ3VvdXMnXG5cbmNvbnN0IGxvZyA9IGRlYnVnKCdlc2xpbnQtcGx1Z2luLWltcG9ydDpFeHBvcnRNYXAnKVxuXG5jb25zdCBleHBvcnRDYWNoZSA9IG5ldyBNYXAoKVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFeHBvcnRNYXAge1xuICBjb25zdHJ1Y3RvcihwYXRoKSB7XG4gICAgdGhpcy5wYXRoID0gcGF0aFxuICAgIHRoaXMubmFtZXNwYWNlID0gbmV3IE1hcCgpXG4gICAgLy8gdG9kbzogcmVzdHJ1Y3R1cmUgdG8ga2V5IG9uIHBhdGgsIHZhbHVlIGlzIHJlc29sdmVyICsgbWFwIG9mIG5hbWVzXG4gICAgdGhpcy5yZWV4cG9ydHMgPSBuZXcgTWFwKClcbiAgICAvKipcbiAgICAgKiBzdGFyLWV4cG9ydHNcbiAgICAgKiBAdHlwZSB7U2V0fSBvZiAoKSA9PiBFeHBvcnRNYXBcbiAgICAgKi9cbiAgICB0aGlzLmRlcGVuZGVuY2llcyA9IG5ldyBTZXQoKVxuICAgIC8qKlxuICAgICAqIGRlcGVuZGVuY2llcyBvZiB0aGlzIG1vZHVsZSB0aGF0IGFyZSBub3QgZXhwbGljaXRseSByZS1leHBvcnRlZFxuICAgICAqIEB0eXBlIHtNYXB9IGZyb20gcGF0aCA9ICgpID0+IEV4cG9ydE1hcFxuICAgICAqL1xuICAgIHRoaXMuaW1wb3J0cyA9IG5ldyBNYXAoKVxuICAgIHRoaXMuZXJyb3JzID0gW11cbiAgfVxuXG4gIGdldCBoYXNEZWZhdWx0KCkgeyByZXR1cm4gdGhpcy5nZXQoJ2RlZmF1bHQnKSAhPSBudWxsIH0gLy8gc3Ryb25nZXIgdGhhbiB0aGlzLmhhc1xuXG4gIGdldCBzaXplKCkge1xuICAgIGxldCBzaXplID0gdGhpcy5uYW1lc3BhY2Uuc2l6ZSArIHRoaXMucmVleHBvcnRzLnNpemVcbiAgICB0aGlzLmRlcGVuZGVuY2llcy5mb3JFYWNoKGRlcCA9PiB7XG4gICAgICBjb25zdCBkID0gZGVwKClcbiAgICAgIC8vIENKUyAvIGlnbm9yZWQgZGVwZW5kZW5jaWVzIHdvbid0IGV4aXN0ICgjNzE3KVxuICAgICAgaWYgKGQgPT0gbnVsbCkgcmV0dXJuXG4gICAgICBzaXplICs9IGQuc2l6ZVxuICAgIH0pXG4gICAgcmV0dXJuIHNpemVcbiAgfVxuXG4gIC8qKlxuICAgKiBOb3RlIHRoYXQgdGhpcyBkb2VzIG5vdCBjaGVjayBleHBsaWNpdGx5IHJlLWV4cG9ydGVkIG5hbWVzIGZvciBleGlzdGVuY2VcbiAgICogaW4gdGhlIGJhc2UgbmFtZXNwYWNlLCBidXQgaXQgd2lsbCBleHBhbmQgYWxsIGBleHBvcnQgKiBmcm9tICcuLi4nYCBleHBvcnRzXG4gICAqIGlmIG5vdCBmb3VuZCBpbiB0aGUgZXhwbGljaXQgbmFtZXNwYWNlLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9ICBuYW1lXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IHRydWUgaWYgYG5hbWVgIGlzIGV4cG9ydGVkIGJ5IHRoaXMgbW9kdWxlLlxuICAgKi9cbiAgaGFzKG5hbWUpIHtcbiAgICBpZiAodGhpcy5uYW1lc3BhY2UuaGFzKG5hbWUpKSByZXR1cm4gdHJ1ZVxuICAgIGlmICh0aGlzLnJlZXhwb3J0cy5oYXMobmFtZSkpIHJldHVybiB0cnVlXG5cbiAgICAvLyBkZWZhdWx0IGV4cG9ydHMgbXVzdCBiZSBleHBsaWNpdGx5IHJlLWV4cG9ydGVkICgjMzI4KVxuICAgIGlmIChuYW1lICE9PSAnZGVmYXVsdCcpIHtcbiAgICAgIGZvciAobGV0IGRlcCBvZiB0aGlzLmRlcGVuZGVuY2llcykge1xuICAgICAgICBsZXQgaW5uZXJNYXAgPSBkZXAoKVxuXG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZVxuXG4gICAgICAgIGlmIChpbm5lck1hcC5oYXMobmFtZSkpIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvKipcbiAgICogZW5zdXJlIHRoYXQgaW1wb3J0ZWQgbmFtZSBmdWxseSByZXNvbHZlcy5cbiAgICogQHBhcmFtICB7W3R5cGVdfSAgbmFtZSBbZGVzY3JpcHRpb25dXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgW2Rlc2NyaXB0aW9uXVxuICAgKi9cbiAgaGFzRGVlcChuYW1lKSB7XG4gICAgaWYgKHRoaXMubmFtZXNwYWNlLmhhcyhuYW1lKSkgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHBhdGg6IFt0aGlzXSB9XG5cbiAgICBpZiAodGhpcy5yZWV4cG9ydHMuaGFzKG5hbWUpKSB7XG4gICAgICBjb25zdCByZWV4cG9ydHMgPSB0aGlzLnJlZXhwb3J0cy5nZXQobmFtZSlcbiAgICAgICAgICAsIGltcG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpXG5cbiAgICAgIC8vIGlmIGltcG9ydCBpcyBpZ25vcmVkLCByZXR1cm4gZXhwbGljaXQgJ251bGwnXG4gICAgICBpZiAoaW1wb3J0ZWQgPT0gbnVsbCkgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHBhdGg6IFt0aGlzXSB9XG5cbiAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlcywgb25seSBpZiBuYW1lIG1hdGNoZXNcbiAgICAgIGlmIChpbXBvcnRlZC5wYXRoID09PSB0aGlzLnBhdGggJiYgcmVleHBvcnRzLmxvY2FsID09PSBuYW1lKSB7XG4gICAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgcGF0aDogW3RoaXNdIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgZGVlcCA9IGltcG9ydGVkLmhhc0RlZXAocmVleHBvcnRzLmxvY2FsKVxuICAgICAgZGVlcC5wYXRoLnVuc2hpZnQodGhpcylcblxuICAgICAgcmV0dXJuIGRlZXBcbiAgICB9XG5cblxuICAgIC8vIGRlZmF1bHQgZXhwb3J0cyBtdXN0IGJlIGV4cGxpY2l0bHkgcmUtZXhwb3J0ZWQgKCMzMjgpXG4gICAgaWYgKG5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgZm9yIChsZXQgZGVwIG9mIHRoaXMuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGxldCBpbm5lck1hcCA9IGRlcCgpXG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZVxuXG4gICAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlc1xuICAgICAgICBpZiAoaW5uZXJNYXAucGF0aCA9PT0gdGhpcy5wYXRoKSBjb250aW51ZVxuXG4gICAgICAgIGxldCBpbm5lclZhbHVlID0gaW5uZXJNYXAuaGFzRGVlcChuYW1lKVxuICAgICAgICBpZiAoaW5uZXJWYWx1ZS5mb3VuZCkge1xuICAgICAgICAgIGlubmVyVmFsdWUucGF0aC51bnNoaWZ0KHRoaXMpXG4gICAgICAgICAgcmV0dXJuIGlubmVyVmFsdWVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgcGF0aDogW3RoaXNdIH1cbiAgfVxuXG4gIGdldChuYW1lKSB7XG4gICAgaWYgKHRoaXMubmFtZXNwYWNlLmhhcyhuYW1lKSkgcmV0dXJuIHRoaXMubmFtZXNwYWNlLmdldChuYW1lKVxuXG4gICAgaWYgKHRoaXMucmVleHBvcnRzLmhhcyhuYW1lKSkge1xuICAgICAgY29uc3QgcmVleHBvcnRzID0gdGhpcy5yZWV4cG9ydHMuZ2V0KG5hbWUpXG4gICAgICAgICAgLCBpbXBvcnRlZCA9IHJlZXhwb3J0cy5nZXRJbXBvcnQoKVxuXG4gICAgICAvLyBpZiBpbXBvcnQgaXMgaWdub3JlZCwgcmV0dXJuIGV4cGxpY2l0ICdudWxsJ1xuICAgICAgaWYgKGltcG9ydGVkID09IG51bGwpIHJldHVybiBudWxsXG5cbiAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlcywgb25seSBpZiBuYW1lIG1hdGNoZXNcbiAgICAgIGlmIChpbXBvcnRlZC5wYXRoID09PSB0aGlzLnBhdGggJiYgcmVleHBvcnRzLmxvY2FsID09PSBuYW1lKSByZXR1cm4gdW5kZWZpbmVkXG5cbiAgICAgIHJldHVybiBpbXBvcnRlZC5nZXQocmVleHBvcnRzLmxvY2FsKVxuICAgIH1cblxuICAgIC8vIGRlZmF1bHQgZXhwb3J0cyBtdXN0IGJlIGV4cGxpY2l0bHkgcmUtZXhwb3J0ZWQgKCMzMjgpXG4gICAgaWYgKG5hbWUgIT09ICdkZWZhdWx0Jykge1xuICAgICAgZm9yIChsZXQgZGVwIG9mIHRoaXMuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIGxldCBpbm5lck1hcCA9IGRlcCgpXG4gICAgICAgIC8vIHRvZG86IHJlcG9ydCBhcyB1bnJlc29sdmVkP1xuICAgICAgICBpZiAoIWlubmVyTWFwKSBjb250aW51ZVxuXG4gICAgICAgIC8vIHNhZmVndWFyZCBhZ2FpbnN0IGN5Y2xlc1xuICAgICAgICBpZiAoaW5uZXJNYXAucGF0aCA9PT0gdGhpcy5wYXRoKSBjb250aW51ZVxuXG4gICAgICAgIGxldCBpbm5lclZhbHVlID0gaW5uZXJNYXAuZ2V0KG5hbWUpXG4gICAgICAgIGlmIChpbm5lclZhbHVlICE9PSB1bmRlZmluZWQpIHJldHVybiBpbm5lclZhbHVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuICB9XG5cbiAgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHRoaXMubmFtZXNwYWNlLmZvckVhY2goKHYsIG4pID0+XG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHYsIG4sIHRoaXMpKVxuXG4gICAgdGhpcy5yZWV4cG9ydHMuZm9yRWFjaCgocmVleHBvcnRzLCBuYW1lKSA9PiB7XG4gICAgICBjb25zdCByZWV4cG9ydGVkID0gcmVleHBvcnRzLmdldEltcG9ydCgpXG4gICAgICAvLyBjYW4ndCBsb29rIHVwIG1ldGEgZm9yIGlnbm9yZWQgcmUtZXhwb3J0cyAoIzM0OClcbiAgICAgIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgcmVleHBvcnRlZCAmJiByZWV4cG9ydGVkLmdldChyZWV4cG9ydHMubG9jYWwpLCBuYW1lLCB0aGlzKVxuICAgIH0pXG5cbiAgICB0aGlzLmRlcGVuZGVuY2llcy5mb3JFYWNoKGRlcCA9PiB7XG4gICAgICBjb25zdCBkID0gZGVwKClcbiAgICAgIC8vIENKUyAvIGlnbm9yZWQgZGVwZW5kZW5jaWVzIHdvbid0IGV4aXN0ICgjNzE3KVxuICAgICAgaWYgKGQgPT0gbnVsbCkgcmV0dXJuXG5cbiAgICAgIGQuZm9yRWFjaCgodiwgbikgPT5cbiAgICAgICAgbiAhPT0gJ2RlZmF1bHQnICYmIGNhbGxiYWNrLmNhbGwodGhpc0FyZywgdiwgbiwgdGhpcykpXG4gICAgfSlcbiAgfVxuXG4gIC8vIHRvZG86IGtleXMsIHZhbHVlcywgZW50cmllcz9cblxuICByZXBvcnRFcnJvcnMoY29udGV4dCwgZGVjbGFyYXRpb24pIHtcbiAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICBub2RlOiBkZWNsYXJhdGlvbi5zb3VyY2UsXG4gICAgICBtZXNzYWdlOiBgUGFyc2UgZXJyb3JzIGluIGltcG9ydGVkIG1vZHVsZSAnJHtkZWNsYXJhdGlvbi5zb3VyY2UudmFsdWV9JzogYCArXG4gICAgICAgICAgICAgICAgICBgJHt0aGlzLmVycm9yc1xuICAgICAgICAgICAgICAgICAgICAgICAgLm1hcChlID0+IGAke2UubWVzc2FnZX0gKCR7ZS5saW5lTnVtYmVyfToke2UuY29sdW1ufSlgKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9YCxcbiAgICB9KVxuICB9XG59XG5cbi8qKlxuICogcGFyc2UgZG9jcyBmcm9tIHRoZSBmaXJzdCBub2RlIHRoYXQgaGFzIGxlYWRpbmcgY29tbWVudHNcbiAqL1xuZnVuY3Rpb24gY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgLi4ubm9kZXMpIHtcbiAgY29uc3QgbWV0YWRhdGEgPSB7fVxuXG4gIC8vICdzb21lJyBzaG9ydC1jaXJjdWl0cyBvbiBmaXJzdCAndHJ1ZSdcbiAgbm9kZXMuc29tZShuID0+IHtcbiAgICB0cnkge1xuXG4gICAgICBsZXQgbGVhZGluZ0NvbW1lbnRzXG5cbiAgICAgIC8vIG4ubGVhZGluZ0NvbW1lbnRzIGlzIGxlZ2FjeSBgYXR0YWNoQ29tbWVudHNgIGJlaGF2aW9yXG4gICAgICBpZiAoJ2xlYWRpbmdDb21tZW50cycgaW4gbikge1xuICAgICAgICBsZWFkaW5nQ29tbWVudHMgPSBuLmxlYWRpbmdDb21tZW50c1xuICAgICAgfSBlbHNlIGlmIChuLnJhbmdlKSB7XG4gICAgICAgIGxlYWRpbmdDb21tZW50cyA9IHNvdXJjZS5nZXRDb21tZW50c0JlZm9yZShuKVxuICAgICAgfVxuXG4gICAgICBpZiAoIWxlYWRpbmdDb21tZW50cyB8fCBsZWFkaW5nQ29tbWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2VcblxuICAgICAgZm9yIChsZXQgbmFtZSBpbiBkb2NTdHlsZVBhcnNlcnMpIHtcbiAgICAgICAgY29uc3QgZG9jID0gZG9jU3R5bGVQYXJzZXJzW25hbWVdKGxlYWRpbmdDb21tZW50cylcbiAgICAgICAgaWYgKGRvYykge1xuICAgICAgICAgIG1ldGFkYXRhLmRvYyA9IGRvY1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIG1ldGFkYXRhXG59XG5cbmNvbnN0IGF2YWlsYWJsZURvY1N0eWxlUGFyc2VycyA9IHtcbiAganNkb2M6IGNhcHR1cmVKc0RvYyxcbiAgdG9tZG9jOiBjYXB0dXJlVG9tRG9jLFxufVxuXG4vKipcbiAqIHBhcnNlIEpTRG9jIGZyb20gbGVhZGluZyBjb21tZW50c1xuICogQHBhcmFtICB7Li4uW3R5cGVdfSBjb21tZW50cyBbZGVzY3JpcHRpb25dXG4gKiBAcmV0dXJuIHt7ZG9jOiBvYmplY3R9fVxuICovXG5mdW5jdGlvbiBjYXB0dXJlSnNEb2MoY29tbWVudHMpIHtcbiAgbGV0IGRvY1xuXG4gIC8vIGNhcHR1cmUgWFNEb2NcbiAgY29tbWVudHMuZm9yRWFjaChjb21tZW50ID0+IHtcbiAgICAvLyBza2lwIG5vbi1ibG9jayBjb21tZW50c1xuICAgIGlmIChjb21tZW50LnR5cGUgIT09ICdCbG9jaycpIHJldHVyblxuICAgIHRyeSB7XG4gICAgICBkb2MgPSBkb2N0cmluZS5wYXJzZShjb21tZW50LnZhbHVlLCB7IHVud3JhcDogdHJ1ZSB9KVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgLyogZG9uJ3QgY2FyZSwgZm9yIG5vdz8gbWF5YmUgYWRkIHRvIGBlcnJvcnM/YCAqL1xuICAgIH1cbiAgfSlcblxuICByZXR1cm4gZG9jXG59XG5cbi8qKlxuICAqIHBhcnNlIFRvbURvYyBzZWN0aW9uIGZyb20gY29tbWVudHNcbiAgKi9cbmZ1bmN0aW9uIGNhcHR1cmVUb21Eb2MoY29tbWVudHMpIHtcbiAgLy8gY29sbGVjdCBsaW5lcyB1cCB0byBmaXJzdCBwYXJhZ3JhcGggYnJlYWtcbiAgY29uc3QgbGluZXMgPSBbXVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY29tbWVudCA9IGNvbW1lbnRzW2ldXG4gICAgaWYgKGNvbW1lbnQudmFsdWUubWF0Y2goL15cXHMqJC8pKSBicmVha1xuICAgIGxpbmVzLnB1c2goY29tbWVudC52YWx1ZS50cmltKCkpXG4gIH1cblxuICAvLyByZXR1cm4gZG9jdHJpbmUtbGlrZSBvYmplY3RcbiAgY29uc3Qgc3RhdHVzTWF0Y2ggPSBsaW5lcy5qb2luKCcgJykubWF0Y2goL14oUHVibGljfEludGVybmFsfERlcHJlY2F0ZWQpOlxccyooLispLylcbiAgaWYgKHN0YXR1c01hdGNoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGRlc2NyaXB0aW9uOiBzdGF0dXNNYXRjaFsyXSxcbiAgICAgIHRhZ3M6IFt7XG4gICAgICAgIHRpdGxlOiBzdGF0dXNNYXRjaFsxXS50b0xvd2VyQ2FzZSgpLFxuICAgICAgICBkZXNjcmlwdGlvbjogc3RhdHVzTWF0Y2hbMl0sXG4gICAgICB9XSxcbiAgICB9XG4gIH1cbn1cblxuRXhwb3J0TWFwLmdldCA9IGZ1bmN0aW9uIChzb3VyY2UsIGNvbnRleHQpIHtcbiAgY29uc3QgcGF0aCA9IHJlc29sdmUoc291cmNlLCBjb250ZXh0KVxuICBpZiAocGF0aCA9PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIHJldHVybiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChwYXRoLCBjb250ZXh0KSlcbn1cblxuRXhwb3J0TWFwLmZvciA9IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gIGNvbnN0IHsgcGF0aCB9ID0gY29udGV4dFxuXG4gIGNvbnN0IGNhY2hlS2V5ID0gaGFzaE9iamVjdChjb250ZXh0KS5kaWdlc3QoJ2hleCcpXG4gIGxldCBleHBvcnRNYXAgPSBleHBvcnRDYWNoZS5nZXQoY2FjaGVLZXkpXG5cbiAgLy8gcmV0dXJuIGNhY2hlZCBpZ25vcmVcbiAgaWYgKGV4cG9ydE1hcCA9PT0gbnVsbCkgcmV0dXJuIG51bGxcblxuICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKHBhdGgpXG4gIGlmIChleHBvcnRNYXAgIT0gbnVsbCkge1xuICAgIC8vIGRhdGUgZXF1YWxpdHkgY2hlY2tcbiAgICBpZiAoZXhwb3J0TWFwLm10aW1lIC0gc3RhdHMubXRpbWUgPT09IDApIHtcbiAgICAgIHJldHVybiBleHBvcnRNYXBcbiAgICB9XG4gICAgLy8gZnV0dXJlOiBjaGVjayBjb250ZW50IGVxdWFsaXR5P1xuICB9XG5cbiAgLy8gY2hlY2sgdmFsaWQgZXh0ZW5zaW9ucyBmaXJzdFxuICBpZiAoIWhhc1ZhbGlkRXh0ZW5zaW9uKHBhdGgsIGNvbnRleHQpKSB7XG4gICAgZXhwb3J0Q2FjaGUuc2V0KGNhY2hlS2V5LCBudWxsKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHBhdGgsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KVxuXG4gIC8vIGNoZWNrIGZvciBhbmQgY2FjaGUgaWdub3JlXG4gIGlmIChpc0lnbm9yZWQocGF0aCwgY29udGV4dCkgfHwgIXVuYW1iaWd1b3VzLnRlc3QoY29udGVudCkpIHtcbiAgICBsb2coJ2lnbm9yZWQgcGF0aCBkdWUgdG8gdW5hbWJpZ3VvdXMgcmVnZXggb3IgaWdub3JlIHNldHRpbmdzOicsIHBhdGgpXG4gICAgZXhwb3J0Q2FjaGUuc2V0KGNhY2hlS2V5LCBudWxsKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBsb2coJ2NhY2hlIG1pc3MnLCBjYWNoZUtleSwgJ2ZvciBwYXRoJywgcGF0aClcbiAgZXhwb3J0TWFwID0gRXhwb3J0TWFwLnBhcnNlKHBhdGgsIGNvbnRlbnQsIGNvbnRleHQpXG5cbiAgLy8gYW1iaWd1b3VzIG1vZHVsZXMgcmV0dXJuIG51bGxcbiAgaWYgKGV4cG9ydE1hcCA9PSBudWxsKSByZXR1cm4gbnVsbFxuXG4gIGV4cG9ydE1hcC5tdGltZSA9IHN0YXRzLm10aW1lXG5cbiAgZXhwb3J0Q2FjaGUuc2V0KGNhY2hlS2V5LCBleHBvcnRNYXApXG4gIHJldHVybiBleHBvcnRNYXBcbn1cblxuXG5FeHBvcnRNYXAucGFyc2UgPSBmdW5jdGlvbiAocGF0aCwgY29udGVudCwgY29udGV4dCkge1xuICB2YXIgbSA9IG5ldyBFeHBvcnRNYXAocGF0aClcblxuICB0cnkge1xuICAgIHZhciBhc3QgPSBwYXJzZShwYXRoLCBjb250ZW50LCBjb250ZXh0KVxuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2coJ3BhcnNlIGVycm9yOicsIHBhdGgsIGVycilcbiAgICBtLmVycm9ycy5wdXNoKGVycilcbiAgICByZXR1cm4gbSAvLyBjYW4ndCBjb250aW51ZVxuICB9XG5cbiAgaWYgKCF1bmFtYmlndW91cy5pc01vZHVsZShhc3QpKSByZXR1cm4gbnVsbFxuXG4gIGNvbnN0IGRvY3N0eWxlID0gKGNvbnRleHQuc2V0dGluZ3MgJiYgY29udGV4dC5zZXR0aW5nc1snaW1wb3J0L2RvY3N0eWxlJ10pIHx8IFsnanNkb2MnXVxuICBjb25zdCBkb2NTdHlsZVBhcnNlcnMgPSB7fVxuICBkb2NzdHlsZS5mb3JFYWNoKHN0eWxlID0+IHtcbiAgICBkb2NTdHlsZVBhcnNlcnNbc3R5bGVdID0gYXZhaWxhYmxlRG9jU3R5bGVQYXJzZXJzW3N0eWxlXVxuICB9KVxuXG4gIC8vIGF0dGVtcHQgdG8gY29sbGVjdCBtb2R1bGUgZG9jXG4gIGlmIChhc3QuY29tbWVudHMpIHtcbiAgICBhc3QuY29tbWVudHMuc29tZShjID0+IHtcbiAgICAgIGlmIChjLnR5cGUgIT09ICdCbG9jaycpIHJldHVybiBmYWxzZVxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZG9jID0gZG9jdHJpbmUucGFyc2UoYy52YWx1ZSwgeyB1bndyYXA6IHRydWUgfSlcbiAgICAgICAgaWYgKGRvYy50YWdzLnNvbWUodCA9PiB0LnRpdGxlID09PSAnbW9kdWxlJykpIHtcbiAgICAgICAgICBtLmRvYyA9IGRvY1xuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikgeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfSlcbiAgfVxuXG4gIGNvbnN0IG5hbWVzcGFjZXMgPSBuZXcgTWFwKClcblxuICBmdW5jdGlvbiByZW1vdGVQYXRoKHZhbHVlKSB7XG4gICAgcmV0dXJuIHJlc29sdmUucmVsYXRpdmUodmFsdWUsIHBhdGgsIGNvbnRleHQuc2V0dGluZ3MpXG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlSW1wb3J0KHZhbHVlKSB7XG4gICAgY29uc3QgcnAgPSByZW1vdGVQYXRoKHZhbHVlKVxuICAgIGlmIChycCA9PSBudWxsKSByZXR1cm4gbnVsbFxuICAgIHJldHVybiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChycCwgY29udGV4dCkpXG4gIH1cblxuICBmdW5jdGlvbiBnZXROYW1lc3BhY2UoaWRlbnRpZmllcikge1xuICAgIGlmICghbmFtZXNwYWNlcy5oYXMoaWRlbnRpZmllci5uYW1lKSkgcmV0dXJuXG5cbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVJbXBvcnQobmFtZXNwYWNlcy5nZXQoaWRlbnRpZmllci5uYW1lKSlcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhZGROYW1lc3BhY2Uob2JqZWN0LCBpZGVudGlmaWVyKSB7XG4gICAgY29uc3QgbnNmbiA9IGdldE5hbWVzcGFjZShpZGVudGlmaWVyKVxuICAgIGlmIChuc2ZuKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqZWN0LCAnbmFtZXNwYWNlJywgeyBnZXQ6IG5zZm4gfSlcbiAgICB9XG5cbiAgICByZXR1cm4gb2JqZWN0XG4gIH1cblxuICBmdW5jdGlvbiBjYXB0dXJlRGVwZW5kZW5jeShkZWNsYXJhdGlvbikge1xuICAgIGlmIChkZWNsYXJhdGlvbi5zb3VyY2UgPT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgICBjb25zdCBpbXBvcnRlZFNwZWNpZmllcnMgPSBuZXcgU2V0KClcbiAgICBjb25zdCBzdXBwb3J0ZWRUeXBlcyA9IG5ldyBTZXQoWydJbXBvcnREZWZhdWx0U3BlY2lmaWVyJywgJ0ltcG9ydE5hbWVzcGFjZVNwZWNpZmllciddKVxuICAgIGlmIChkZWNsYXJhdGlvbi5zcGVjaWZpZXJzKSB7XG4gICAgICBkZWNsYXJhdGlvbi5zcGVjaWZpZXJzLmZvckVhY2goc3BlY2lmaWVyID0+IHtcbiAgICAgICAgaWYgKHN1cHBvcnRlZFR5cGVzLmhhcyhzcGVjaWZpZXIudHlwZSkpIHtcbiAgICAgICAgICBpbXBvcnRlZFNwZWNpZmllcnMuYWRkKHNwZWNpZmllci50eXBlKVxuICAgICAgICB9XG4gICAgICAgIGlmIChzcGVjaWZpZXIudHlwZSA9PT0gJ0ltcG9ydFNwZWNpZmllcicpIHtcbiAgICAgICAgICBpbXBvcnRlZFNwZWNpZmllcnMuYWRkKHNwZWNpZmllci5pbXBvcnRlZC5uYW1lKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IHAgPSByZW1vdGVQYXRoKGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSlcbiAgICBpZiAocCA9PSBudWxsKSByZXR1cm4gbnVsbFxuICAgIGNvbnN0IGV4aXN0aW5nID0gbS5pbXBvcnRzLmdldChwKVxuICAgIGlmIChleGlzdGluZyAhPSBudWxsKSByZXR1cm4gZXhpc3RpbmcuZ2V0dGVyXG5cbiAgICBjb25zdCBnZXR0ZXIgPSB0aHVua0ZvcihwLCBjb250ZXh0KVxuICAgIG0uaW1wb3J0cy5zZXQocCwge1xuICAgICAgZ2V0dGVyLFxuICAgICAgc291cmNlOiB7ICAvLyBjYXB0dXJpbmcgYWN0dWFsIG5vZGUgcmVmZXJlbmNlIGhvbGRzIGZ1bGwgQVNUIGluIG1lbW9yeSFcbiAgICAgICAgdmFsdWU6IGRlY2xhcmF0aW9uLnNvdXJjZS52YWx1ZSxcbiAgICAgICAgbG9jOiBkZWNsYXJhdGlvbi5zb3VyY2UubG9jLFxuICAgICAgfSxcbiAgICAgIGltcG9ydGVkU3BlY2lmaWVycyxcbiAgICB9KVxuICAgIHJldHVybiBnZXR0ZXJcbiAgfVxuXG4gIGNvbnN0IHNvdXJjZSA9IG1ha2VTb3VyY2VDb2RlKGNvbnRlbnQsIGFzdClcblxuICBhc3QuYm9keS5mb3JFYWNoKGZ1bmN0aW9uIChuKSB7XG5cbiAgICBpZiAobi50eXBlID09PSAnRXhwb3J0RGVmYXVsdERlY2xhcmF0aW9uJykge1xuICAgICAgY29uc3QgZXhwb3J0TWV0YSA9IGNhcHR1cmVEb2Moc291cmNlLCBkb2NTdHlsZVBhcnNlcnMsIG4pXG4gICAgICBpZiAobi5kZWNsYXJhdGlvbi50eXBlID09PSAnSWRlbnRpZmllcicpIHtcbiAgICAgICAgYWRkTmFtZXNwYWNlKGV4cG9ydE1ldGEsIG4uZGVjbGFyYXRpb24pXG4gICAgICB9XG4gICAgICBtLm5hbWVzcGFjZS5zZXQoJ2RlZmF1bHQnLCBleHBvcnRNZXRhKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKG4udHlwZSA9PT0gJ0V4cG9ydEFsbERlY2xhcmF0aW9uJykge1xuICAgICAgY29uc3QgZ2V0dGVyID0gY2FwdHVyZURlcGVuZGVuY3kobilcbiAgICAgIGlmIChnZXR0ZXIpIG0uZGVwZW5kZW5jaWVzLmFkZChnZXR0ZXIpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBjYXB0dXJlIG5hbWVzcGFjZXMgaW4gY2FzZSBvZiBsYXRlciBleHBvcnRcbiAgICBpZiAobi50eXBlID09PSAnSW1wb3J0RGVjbGFyYXRpb24nKSB7XG4gICAgICBjYXB0dXJlRGVwZW5kZW5jeShuKVxuICAgICAgbGV0IG5zXG4gICAgICBpZiAobi5zcGVjaWZpZXJzLnNvbWUocyA9PiBzLnR5cGUgPT09ICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInICYmIChucyA9IHMpKSkge1xuICAgICAgICBuYW1lc3BhY2VzLnNldChucy5sb2NhbC5uYW1lLCBuLnNvdXJjZS52YWx1ZSlcbiAgICAgIH1cbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmIChuLnR5cGUgPT09ICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJykge1xuICAgICAgLy8gY2FwdHVyZSBkZWNsYXJhdGlvblxuICAgICAgaWYgKG4uZGVjbGFyYXRpb24gIT0gbnVsbCkge1xuICAgICAgICBzd2l0Y2ggKG4uZGVjbGFyYXRpb24udHlwZSkge1xuICAgICAgICAgIGNhc2UgJ0Z1bmN0aW9uRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ0NsYXNzRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1R5cGVBbGlhcyc6IC8vIGZsb3d0eXBlIHdpdGggYmFiZWwtZXNsaW50IHBhcnNlclxuICAgICAgICAgIGNhc2UgJ0ludGVyZmFjZURlY2xhcmF0aW9uJzpcbiAgICAgICAgICBjYXNlICdEZWNsYXJlRnVuY3Rpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTRGVjbGFyZUZ1bmN0aW9uJzpcbiAgICAgICAgICBjYXNlICdUU0VudW1EZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNUeXBlQWxpYXNEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNJbnRlcmZhY2VEZWNsYXJhdGlvbic6XG4gICAgICAgICAgY2FzZSAnVFNBYnN0cmFjdENsYXNzRGVjbGFyYXRpb24nOlxuICAgICAgICAgIGNhc2UgJ1RTTW9kdWxlRGVjbGFyYXRpb24nOlxuICAgICAgICAgICAgbS5uYW1lc3BhY2Uuc2V0KG4uZGVjbGFyYXRpb24uaWQubmFtZSwgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgbikpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ1ZhcmlhYmxlRGVjbGFyYXRpb24nOlxuICAgICAgICAgICAgbi5kZWNsYXJhdGlvbi5kZWNsYXJhdGlvbnMuZm9yRWFjaCgoZCkgPT5cbiAgICAgICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZC5pZCxcbiAgICAgICAgICAgICAgICBpZCA9PiBtLm5hbWVzcGFjZS5zZXQoaWQubmFtZSwgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgZCwgbikpKSlcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgbnNvdXJjZSA9IG4uc291cmNlICYmIG4uc291cmNlLnZhbHVlXG4gICAgICBuLnNwZWNpZmllcnMuZm9yRWFjaCgocykgPT4ge1xuICAgICAgICBjb25zdCBleHBvcnRNZXRhID0ge31cbiAgICAgICAgbGV0IGxvY2FsXG5cbiAgICAgICAgc3dpdGNoIChzLnR5cGUpIHtcbiAgICAgICAgICBjYXNlICdFeHBvcnREZWZhdWx0U3BlY2lmaWVyJzpcbiAgICAgICAgICAgIGlmICghbi5zb3VyY2UpIHJldHVyblxuICAgICAgICAgICAgbG9jYWwgPSAnZGVmYXVsdCdcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAnRXhwb3J0TmFtZXNwYWNlU3BlY2lmaWVyJzpcbiAgICAgICAgICAgIG0ubmFtZXNwYWNlLnNldChzLmV4cG9ydGVkLm5hbWUsIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRNZXRhLCAnbmFtZXNwYWNlJywge1xuICAgICAgICAgICAgICBnZXQoKSB7IHJldHVybiByZXNvbHZlSW1wb3J0KG5zb3VyY2UpIH0sXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIGNhc2UgJ0V4cG9ydFNwZWNpZmllcic6XG4gICAgICAgICAgICBpZiAoIW4uc291cmNlKSB7XG4gICAgICAgICAgICAgIG0ubmFtZXNwYWNlLnNldChzLmV4cG9ydGVkLm5hbWUsIGFkZE5hbWVzcGFjZShleHBvcnRNZXRhLCBzLmxvY2FsKSlcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBlbHNlIGZhbGxzIHRocm91Z2hcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgbG9jYWwgPSBzLmxvY2FsLm5hbWVcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cblxuICAgICAgICAvLyB0b2RvOiBKU0RvY1xuICAgICAgICBtLnJlZXhwb3J0cy5zZXQocy5leHBvcnRlZC5uYW1lLCB7IGxvY2FsLCBnZXRJbXBvcnQ6ICgpID0+IHJlc29sdmVJbXBvcnQobnNvdXJjZSkgfSlcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgLy8gVGhpcyBkb2Vzbid0IGRlY2xhcmUgYW55dGhpbmcsIGJ1dCBjaGFuZ2VzIHdoYXQncyBiZWluZyBleHBvcnRlZC5cbiAgICBpZiAobi50eXBlID09PSAnVFNFeHBvcnRBc3NpZ25tZW50Jykge1xuICAgICAgY29uc3QgbW9kdWxlRGVjbHMgPSBhc3QuYm9keS5maWx0ZXIoKGJvZHlOb2RlKSA9PlxuICAgICAgICBib2R5Tm9kZS50eXBlID09PSAnVFNNb2R1bGVEZWNsYXJhdGlvbicgJiYgYm9keU5vZGUuaWQubmFtZSA9PT0gbi5leHByZXNzaW9uLm5hbWVcbiAgICAgIClcbiAgICAgIG1vZHVsZURlY2xzLmZvckVhY2goKG1vZHVsZURlY2wpID0+IHtcbiAgICAgICAgaWYgKG1vZHVsZURlY2wgJiYgbW9kdWxlRGVjbC5ib2R5ICYmIG1vZHVsZURlY2wuYm9keS5ib2R5KSB7XG4gICAgICAgICAgbW9kdWxlRGVjbC5ib2R5LmJvZHkuZm9yRWFjaCgobW9kdWxlQmxvY2tOb2RlKSA9PiB7XG4gICAgICAgICAgICAvLyBFeHBvcnQtYXNzaWdubWVudCBleHBvcnRzIGFsbCBtZW1iZXJzIGluIHRoZSBuYW1lc3BhY2UsIGV4cGxpY2l0bHkgZXhwb3J0ZWQgb3Igbm90LlxuICAgICAgICAgICAgY29uc3QgZXhwb3J0ZWREZWNsID0gbW9kdWxlQmxvY2tOb2RlLnR5cGUgPT09ICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJyA/XG4gICAgICAgICAgICAgIG1vZHVsZUJsb2NrTm9kZS5kZWNsYXJhdGlvbiA6XG4gICAgICAgICAgICAgIG1vZHVsZUJsb2NrTm9kZVxuXG4gICAgICAgICAgICBpZiAoZXhwb3J0ZWREZWNsLnR5cGUgPT09ICdWYXJpYWJsZURlY2xhcmF0aW9uJykge1xuICAgICAgICAgICAgICBleHBvcnRlZERlY2wuZGVjbGFyYXRpb25zLmZvckVhY2goKGRlY2wpID0+XG4gICAgICAgICAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUoZGVjbC5pZCwoaWQpID0+IG0ubmFtZXNwYWNlLnNldChcbiAgICAgICAgICAgICAgICAgIGlkLm5hbWUsXG4gICAgICAgICAgICAgICAgICBjYXB0dXJlRG9jKHNvdXJjZSwgZG9jU3R5bGVQYXJzZXJzLCBkZWNsLCBleHBvcnRlZERlY2wsIG1vZHVsZUJsb2NrTm9kZSkpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBtLm5hbWVzcGFjZS5zZXQoXG4gICAgICAgICAgICAgICAgZXhwb3J0ZWREZWNsLmlkLm5hbWUsXG4gICAgICAgICAgICAgICAgY2FwdHVyZURvYyhzb3VyY2UsIGRvY1N0eWxlUGFyc2VycywgbW9kdWxlQmxvY2tOb2RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gbVxufVxuXG4vKipcbiAqIFRoZSBjcmVhdGlvbiBvZiB0aGlzIGNsb3N1cmUgaXMgaXNvbGF0ZWQgZnJvbSBvdGhlciBzY29wZXNcbiAqIHRvIGF2b2lkIG92ZXItcmV0ZW50aW9uIG9mIHVucmVsYXRlZCB2YXJpYWJsZXMsIHdoaWNoIGhhc1xuICogY2F1c2VkIG1lbW9yeSBsZWFrcy4gU2VlICMxMjY2LlxuICovXG5mdW5jdGlvbiB0aHVua0ZvcihwLCBjb250ZXh0KSB7XG4gIHJldHVybiAoKSA9PiBFeHBvcnRNYXAuZm9yKGNoaWxkQ29udGV4dChwLCBjb250ZXh0KSlcbn1cblxuXG4vKipcbiAqIFRyYXZlcnNlIGEgcGF0dGVybi9pZGVudGlmaWVyIG5vZGUsIGNhbGxpbmcgJ2NhbGxiYWNrJ1xuICogZm9yIGVhY2ggbGVhZiBpZGVudGlmaWVyLlxuICogQHBhcmFtICB7bm9kZX0gICBwYXR0ZXJuXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWN1cnNpdmVQYXR0ZXJuQ2FwdHVyZShwYXR0ZXJuLCBjYWxsYmFjaykge1xuICBzd2l0Y2ggKHBhdHRlcm4udHlwZSkge1xuICAgIGNhc2UgJ0lkZW50aWZpZXInOiAvLyBiYXNlIGNhc2VcbiAgICAgIGNhbGxiYWNrKHBhdHRlcm4pXG4gICAgICBicmVha1xuXG4gICAgY2FzZSAnT2JqZWN0UGF0dGVybic6XG4gICAgICBwYXR0ZXJuLnByb3BlcnRpZXMuZm9yRWFjaChwID0+IHtcbiAgICAgICAgcmVjdXJzaXZlUGF0dGVybkNhcHR1cmUocC52YWx1ZSwgY2FsbGJhY2spXG4gICAgICB9KVxuICAgICAgYnJlYWtcblxuICAgIGNhc2UgJ0FycmF5UGF0dGVybic6XG4gICAgICBwYXR0ZXJuLmVsZW1lbnRzLmZvckVhY2goKGVsZW1lbnQpID0+IHtcbiAgICAgICAgaWYgKGVsZW1lbnQgPT0gbnVsbCkgcmV0dXJuXG4gICAgICAgIHJlY3Vyc2l2ZVBhdHRlcm5DYXB0dXJlKGVsZW1lbnQsIGNhbGxiYWNrKVxuICAgICAgfSlcbiAgICAgIGJyZWFrXG5cbiAgICBjYXNlICdBc3NpZ25tZW50UGF0dGVybic6XG4gICAgICBjYWxsYmFjayhwYXR0ZXJuLmxlZnQpXG4gICAgICBicmVha1xuICB9XG59XG5cbi8qKlxuICogZG9uJ3QgaG9sZCBmdWxsIGNvbnRleHQgb2JqZWN0IGluIG1lbW9yeSwganVzdCBncmFiIHdoYXQgd2UgbmVlZC5cbiAqL1xuZnVuY3Rpb24gY2hpbGRDb250ZXh0KHBhdGgsIGNvbnRleHQpIHtcbiAgY29uc3QgeyBzZXR0aW5ncywgcGFyc2VyT3B0aW9ucywgcGFyc2VyUGF0aCB9ID0gY29udGV4dFxuICByZXR1cm4ge1xuICAgIHNldHRpbmdzLFxuICAgIHBhcnNlck9wdGlvbnMsXG4gICAgcGFyc2VyUGF0aCxcbiAgICBwYXRoLFxuICB9XG59XG5cblxuLyoqXG4gKiBzb21ldGltZXMgbGVnYWN5IHN1cHBvcnQgaXNuJ3QgX3RoYXRfIGhhcmQuLi4gcmlnaHQ/XG4gKi9cbmZ1bmN0aW9uIG1ha2VTb3VyY2VDb2RlKHRleHQsIGFzdCkge1xuICBpZiAoU291cmNlQ29kZS5sZW5ndGggPiAxKSB7XG4gICAgLy8gRVNMaW50IDNcbiAgICByZXR1cm4gbmV3IFNvdXJjZUNvZGUodGV4dCwgYXN0KVxuICB9IGVsc2Uge1xuICAgIC8vIEVTTGludCA0LCA1XG4gICAgcmV0dXJuIG5ldyBTb3VyY2VDb2RlKHsgdGV4dCwgYXN0IH0pXG4gIH1cbn1cbiJdfQ==