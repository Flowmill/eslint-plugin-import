'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _readPkgUp = require('read-pkg-up');

var _readPkgUp2 = _interopRequireDefault(_readPkgUp);

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _importType = require('../core/importType');

var _importType2 = _interopRequireDefault(_importType);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function hasKeys() {
  let obj = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  return Object.keys(obj).length > 0;
}

function arrayOrKeys(arrayOrObject) {
  return Array.isArray(arrayOrObject) ? arrayOrObject : Object.keys(arrayOrObject);
}

function extractDepFields(pkg) {
  return {
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    optionalDependencies: pkg.optionalDependencies || {},
    peerDependencies: pkg.peerDependencies || {},
    // BundledDeps should be in the form of an array, but object notation is also supported by
    // `npm`, so we convert it to an array if it is an object
    bundledDependencies: arrayOrKeys(pkg.bundleDependencies || pkg.bundledDependencies || [])
  };
}

function getDependencies(context, packageDir) {
  let paths = [];
  try {
    const packageContent = {
      dependencies: {},
      devDependencies: {},
      optionalDependencies: {},
      peerDependencies: {},
      bundledDependencies: []
    };

    if (packageDir && packageDir.length > 0) {
      if (!Array.isArray(packageDir)) {
        paths = [_path2.default.resolve(packageDir)];
      } else {
        paths = packageDir.map(dir => _path2.default.resolve(dir));
      }
    }

    if (paths.length > 0) {
      // use rule config to find package.json
      paths.forEach(dir => {
        const _packageContent = extractDepFields(JSON.parse(_fs2.default.readFileSync(_path2.default.join(dir, 'package.json'), 'utf8')));
        Object.keys(packageContent).forEach(depsKey => Object.assign(packageContent[depsKey], _packageContent[depsKey]));
      });
    } else {
      // use closest package.json
      Object.assign(packageContent, extractDepFields(_readPkgUp2.default.sync({ cwd: context.getFilename(), normalize: false }).pkg));
    }

    if (![packageContent.dependencies, packageContent.devDependencies, packageContent.optionalDependencies, packageContent.peerDependencies, packageContent.bundledDependencies].some(hasKeys)) {
      return null;
    }

    return packageContent;
  } catch (e) {
    if (paths.length > 0 && e.code === 'ENOENT') {
      context.report({
        message: 'The package.json file could not be found.',
        loc: { line: 0, column: 0 }
      });
    }
    if (e.name === 'JSONError' || e instanceof SyntaxError) {
      context.report({
        message: 'The package.json file could not be parsed: ' + e.message,
        loc: { line: 0, column: 0 }
      });
    }

    return null;
  }
}

function missingErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's dependencies. ` + `Run 'npm i -S ${packageName}' to add it`;
}

function devDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's dependencies, not devDependencies.`;
}

function optDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's dependencies, ` + `not optionalDependencies.`;
}

function reportIfMissing(context, deps, depsOptions, node, name) {
  // Do not report when importing types
  if (node.importKind === 'type') {
    return;
  }

  if ((0, _importType2.default)(name, context) !== 'external') {
    return;
  }

  const resolved = (0, _resolve2.default)(name, context);
  if (!resolved) {
    return;
  }

  const splitName = name.split('/');
  const packageName = splitName[0][0] === '@' ? splitName.slice(0, 2).join('/') : splitName[0];
  const isInDeps = deps.dependencies[packageName] !== undefined;
  const isInDevDeps = deps.devDependencies[packageName] !== undefined;
  const isInOptDeps = deps.optionalDependencies[packageName] !== undefined;
  const isInPeerDeps = deps.peerDependencies[packageName] !== undefined;
  const isInBundledDeps = deps.bundledDependencies.indexOf(packageName) !== -1;

  if (isInDeps || depsOptions.allowDevDeps && isInDevDeps || depsOptions.allowPeerDeps && isInPeerDeps || depsOptions.allowOptDeps && isInOptDeps || depsOptions.allowBundledDeps && isInBundledDeps) {
    return;
  }

  if (isInDevDeps && !depsOptions.allowDevDeps) {
    context.report(node, devDepErrorMessage(packageName));
    return;
  }

  if (isInOptDeps && !depsOptions.allowOptDeps) {
    context.report(node, optDepErrorMessage(packageName));
    return;
  }

  context.report(node, missingErrorMessage(packageName));
}

function testConfig(config, filename) {
  // Simplest configuration first, either a boolean or nothing.
  if (typeof config === 'boolean' || typeof config === 'undefined') {
    return config;
  }
  // Array of globs.
  return config.some(c => (0, _minimatch2.default)(filename, c) || (0, _minimatch2.default)(filename, _path2.default.join(process.cwd(), c)));
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      url: (0, _docsUrl2.default)('no-extraneous-dependencies')
    },

    schema: [{
      'type': 'object',
      'properties': {
        'devDependencies': { 'type': ['boolean', 'array'] },
        'optionalDependencies': { 'type': ['boolean', 'array'] },
        'peerDependencies': { 'type': ['boolean', 'array'] },
        'bundledDependencies': { 'type': ['boolean', 'array'] },
        'packageDir': { 'type': ['string', 'array'] }
      },
      'additionalProperties': false
    }]
  },

  create: function (context) {
    const options = context.options[0] || {};
    const filename = context.getFilename();
    const deps = getDependencies(context, options.packageDir) || extractDepFields({});

    const depsOptions = {
      allowDevDeps: testConfig(options.devDependencies, filename) !== false,
      allowOptDeps: testConfig(options.optionalDependencies, filename) !== false,
      allowPeerDeps: testConfig(options.peerDependencies, filename) !== false,
      allowBundledDeps: testConfig(options.bundledDependencies, filename) !== false

      // todo: use module visitor from module-utils core
    };return {
      ImportDeclaration: function (node) {
        reportIfMissing(context, deps, depsOptions, node, node.source.value);
      },
      CallExpression: function handleRequires(node) {
        if ((0, _staticRequire2.default)(node)) {
          reportIfMissing(context, deps, depsOptions, node, node.arguments[0].value);
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uby1leHRyYW5lb3VzLWRlcGVuZGVuY2llcy5qcyJdLCJuYW1lcyI6WyJoYXNLZXlzIiwib2JqIiwiT2JqZWN0Iiwia2V5cyIsImxlbmd0aCIsImFycmF5T3JLZXlzIiwiYXJyYXlPck9iamVjdCIsIkFycmF5IiwiaXNBcnJheSIsImV4dHJhY3REZXBGaWVsZHMiLCJwa2ciLCJkZXBlbmRlbmNpZXMiLCJkZXZEZXBlbmRlbmNpZXMiLCJvcHRpb25hbERlcGVuZGVuY2llcyIsInBlZXJEZXBlbmRlbmNpZXMiLCJidW5kbGVkRGVwZW5kZW5jaWVzIiwiYnVuZGxlRGVwZW5kZW5jaWVzIiwiZ2V0RGVwZW5kZW5jaWVzIiwiY29udGV4dCIsInBhY2thZ2VEaXIiLCJwYXRocyIsInBhY2thZ2VDb250ZW50IiwicGF0aCIsInJlc29sdmUiLCJtYXAiLCJkaXIiLCJmb3JFYWNoIiwiX3BhY2thZ2VDb250ZW50IiwiSlNPTiIsInBhcnNlIiwiZnMiLCJyZWFkRmlsZVN5bmMiLCJqb2luIiwiZGVwc0tleSIsImFzc2lnbiIsInJlYWRQa2dVcCIsInN5bmMiLCJjd2QiLCJnZXRGaWxlbmFtZSIsIm5vcm1hbGl6ZSIsInNvbWUiLCJlIiwiY29kZSIsInJlcG9ydCIsIm1lc3NhZ2UiLCJsb2MiLCJsaW5lIiwiY29sdW1uIiwibmFtZSIsIlN5bnRheEVycm9yIiwibWlzc2luZ0Vycm9yTWVzc2FnZSIsInBhY2thZ2VOYW1lIiwiZGV2RGVwRXJyb3JNZXNzYWdlIiwib3B0RGVwRXJyb3JNZXNzYWdlIiwicmVwb3J0SWZNaXNzaW5nIiwiZGVwcyIsImRlcHNPcHRpb25zIiwibm9kZSIsImltcG9ydEtpbmQiLCJyZXNvbHZlZCIsInNwbGl0TmFtZSIsInNwbGl0Iiwic2xpY2UiLCJpc0luRGVwcyIsInVuZGVmaW5lZCIsImlzSW5EZXZEZXBzIiwiaXNJbk9wdERlcHMiLCJpc0luUGVlckRlcHMiLCJpc0luQnVuZGxlZERlcHMiLCJpbmRleE9mIiwiYWxsb3dEZXZEZXBzIiwiYWxsb3dQZWVyRGVwcyIsImFsbG93T3B0RGVwcyIsImFsbG93QnVuZGxlZERlcHMiLCJ0ZXN0Q29uZmlnIiwiY29uZmlnIiwiZmlsZW5hbWUiLCJjIiwicHJvY2VzcyIsIm1vZHVsZSIsImV4cG9ydHMiLCJtZXRhIiwidHlwZSIsImRvY3MiLCJ1cmwiLCJzY2hlbWEiLCJjcmVhdGUiLCJvcHRpb25zIiwiSW1wb3J0RGVjbGFyYXRpb24iLCJzb3VyY2UiLCJ2YWx1ZSIsIkNhbGxFeHByZXNzaW9uIiwiaGFuZGxlUmVxdWlyZXMiLCJhcmd1bWVudHMiXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7Ozs7O0FBRUEsU0FBU0EsT0FBVCxHQUEyQjtBQUFBLE1BQVZDLEdBQVUsdUVBQUosRUFBSTs7QUFDekIsU0FBT0MsT0FBT0MsSUFBUCxDQUFZRixHQUFaLEVBQWlCRyxNQUFqQixHQUEwQixDQUFqQztBQUNEOztBQUVELFNBQVNDLFdBQVQsQ0FBcUJDLGFBQXJCLEVBQW9DO0FBQ2xDLFNBQU9DLE1BQU1DLE9BQU4sQ0FBY0YsYUFBZCxJQUErQkEsYUFBL0IsR0FBK0NKLE9BQU9DLElBQVAsQ0FBWUcsYUFBWixDQUF0RDtBQUNEOztBQUVELFNBQVNHLGdCQUFULENBQTBCQyxHQUExQixFQUErQjtBQUM3QixTQUFPO0FBQ0xDLGtCQUFjRCxJQUFJQyxZQUFKLElBQW9CLEVBRDdCO0FBRUxDLHFCQUFpQkYsSUFBSUUsZUFBSixJQUF1QixFQUZuQztBQUdMQywwQkFBc0JILElBQUlHLG9CQUFKLElBQTRCLEVBSDdDO0FBSUxDLHNCQUFrQkosSUFBSUksZ0JBQUosSUFBd0IsRUFKckM7QUFLTDtBQUNBO0FBQ0FDLHlCQUFxQlYsWUFBWUssSUFBSU0sa0JBQUosSUFBMEJOLElBQUlLLG1CQUE5QixJQUFxRCxFQUFqRTtBQVBoQixHQUFQO0FBU0Q7O0FBRUQsU0FBU0UsZUFBVCxDQUF5QkMsT0FB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LEVBQWtCSCxLQUFwRTtBQUNEO0FBQ0Y7QUFSSSxLQUFQO0FBVUQ7QUE3Q2MsQ0FBakIiLCJmaWxlIjoibm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IHJlYWRQa2dVcCBmcm9tICdyZWFkLXBrZy11cCdcbmltcG9ydCBtaW5pbWF0Y2ggZnJvbSAnbWluaW1hdGNoJ1xuaW1wb3J0IHJlc29sdmUgZnJvbSAnZXNsaW50LW1vZHVsZS11dGlscy9yZXNvbHZlJ1xuaW1wb3J0IGltcG9ydFR5cGUgZnJvbSAnLi4vY29yZS9pbXBvcnRUeXBlJ1xuaW1wb3J0IGlzU3RhdGljUmVxdWlyZSBmcm9tICcuLi9jb3JlL3N0YXRpY1JlcXVpcmUnXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5mdW5jdGlvbiBoYXNLZXlzKG9iaiA9IHt9KSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA+IDBcbn1cblxuZnVuY3Rpb24gYXJyYXlPcktleXMoYXJyYXlPck9iamVjdCkge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcnJheU9yT2JqZWN0KSA/IGFycmF5T3JPYmplY3QgOiBPYmplY3Qua2V5cyhhcnJheU9yT2JqZWN0KVxufVxuXG5mdW5jdGlvbiBleHRyYWN0RGVwRmllbGRzKHBrZykge1xuICByZXR1cm4ge1xuICAgIGRlcGVuZGVuY2llczogcGtnLmRlcGVuZGVuY2llcyB8fCB7fSxcbiAgICBkZXZEZXBlbmRlbmNpZXM6IHBrZy5kZXZEZXBlbmRlbmNpZXMgfHwge30sXG4gICAgb3B0aW9uYWxEZXBlbmRlbmNpZXM6IHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyB8fCB7fSxcbiAgICBwZWVyRGVwZW5kZW5jaWVzOiBwa2cucGVlckRlcGVuZGVuY2llcyB8fCB7fSxcbiAgICAvLyBCdW5kbGVkRGVwcyBzaG91bGQgYmUgaW4gdGhlIGZvcm0gb2YgYW4gYXJyYXksIGJ1dCBvYmplY3Qgbm90YXRpb24gaXMgYWxzbyBzdXBwb3J0ZWQgYnlcbiAgICAvLyBgbnBtYCwgc28gd2UgY29udmVydCBpdCB0byBhbiBhcnJheSBpZiBpdCBpcyBhbiBvYmplY3RcbiAgICBidW5kbGVkRGVwZW5kZW5jaWVzOiBhcnJheU9yS2V5cyhwa2cuYnVuZGxlRGVwZW5kZW5jaWVzIHx8IHBrZy5idW5kbGVkRGVwZW5kZW5jaWVzIHx8IFtdKVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldERlcGVuZGVuY2llcyhjb250ZXh0LCBwYWNrYWdlRGlyKSB7XG4gIGxldCBwYXRocyA9IFtdXG4gIHRyeSB7XG4gICAgY29uc3QgcGFja2FnZUNvbnRlbnQgPSB7XG4gICAgICBkZXBlbmRlbmNpZXM6IHt9LFxuICAgICAgZGV2RGVwZW5kZW5jaWVzOiB7fSxcbiAgICAgIG9wdGlvbmFsRGVwZW5kZW5jaWVzOiB7fSxcbiAgICAgIHBlZXJEZXBlbmRlbmNpZXM6IHt9LFxuICAgICAgYnVuZGxlZERlcGVuZGVuY2llczogW10sXG4gICAgfVxuXG4gICAgaWYgKHBhY2thZ2VEaXIgJiYgcGFja2FnZURpci5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFja2FnZURpcikpIHtcbiAgICAgICAgcGF0aHMgPSBbcGF0aC5yZXNvbHZlKHBhY2thZ2VEaXIpXVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGF0aHMgPSBwYWNrYWdlRGlyLm1hcChkaXIgPT4gcGF0aC5yZXNvbHZlKGRpcikpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhdGhzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIHVzZSBydWxlIGNvbmZpZyB0byBmaW5kIHBhY2thZ2UuanNvblxuICAgICAgcGF0aHMuZm9yRWFjaChkaXIgPT4ge1xuICAgICAgICBjb25zdCBfcGFja2FnZUNvbnRlbnQgPSBleHRyYWN0RGVwRmllbGRzKFxuICAgICAgICAgIEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihkaXIsICdwYWNrYWdlLmpzb24nKSwgJ3V0ZjgnKSlcbiAgICAgICAgKVxuICAgICAgICBPYmplY3Qua2V5cyhwYWNrYWdlQ29udGVudCkuZm9yRWFjaChkZXBzS2V5ID0+XG4gICAgICAgICAgT2JqZWN0LmFzc2lnbihwYWNrYWdlQ29udGVudFtkZXBzS2V5XSwgX3BhY2thZ2VDb250ZW50W2RlcHNLZXldKVxuICAgICAgICApXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyB1c2UgY2xvc2VzdCBwYWNrYWdlLmpzb25cbiAgICAgIE9iamVjdC5hc3NpZ24oXG4gICAgICAgIHBhY2thZ2VDb250ZW50LFxuICAgICAgICBleHRyYWN0RGVwRmllbGRzKFxuICAgICAgICAgIHJlYWRQa2dVcC5zeW5jKHtjd2Q6IGNvbnRleHQuZ2V0RmlsZW5hbWUoKSwgbm9ybWFsaXplOiBmYWxzZX0pLnBrZ1xuICAgICAgICApXG4gICAgICApXG4gICAgfVxuXG4gICAgaWYgKCFbXG4gICAgICBwYWNrYWdlQ29udGVudC5kZXBlbmRlbmNpZXMsXG4gICAgICBwYWNrYWdlQ29udGVudC5kZXZEZXBlbmRlbmNpZXMsXG4gICAgICBwYWNrYWdlQ29udGVudC5vcHRpb25hbERlcGVuZGVuY2llcyxcbiAgICAgIHBhY2thZ2VDb250ZW50LnBlZXJEZXBlbmRlbmNpZXMsXG4gICAgICBwYWNrYWdlQ29udGVudC5idW5kbGVkRGVwZW5kZW5jaWVzLFxuICAgIF0uc29tZShoYXNLZXlzKSkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICByZXR1cm4gcGFja2FnZUNvbnRlbnRcbiAgfSBjYXRjaCAoZSkge1xuICAgIGlmIChwYXRocy5sZW5ndGggPiAwICYmIGUuY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgbWVzc2FnZTogJ1RoZSBwYWNrYWdlLmpzb24gZmlsZSBjb3VsZCBub3QgYmUgZm91bmQuJyxcbiAgICAgICAgbG9jOiB7IGxpbmU6IDAsIGNvbHVtbjogMCB9LFxuICAgICAgfSlcbiAgICB9XG4gICAgaWYgKGUubmFtZSA9PT0gJ0pTT05FcnJvcicgfHwgZSBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgIG1lc3NhZ2U6ICdUaGUgcGFja2FnZS5qc29uIGZpbGUgY291bGQgbm90IGJlIHBhcnNlZDogJyArIGUubWVzc2FnZSxcbiAgICAgICAgbG9jOiB7IGxpbmU6IDAsIGNvbHVtbjogMCB9LFxuICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbFxuICB9XG59XG5cbmZ1bmN0aW9uIG1pc3NpbmdFcnJvck1lc3NhZ2UocGFja2FnZU5hbWUpIHtcbiAgcmV0dXJuIGAnJHtwYWNrYWdlTmFtZX0nIHNob3VsZCBiZSBsaXN0ZWQgaW4gdGhlIHByb2plY3QncyBkZXBlbmRlbmNpZXMuIGAgK1xuICAgIGBSdW4gJ25wbSBpIC1TICR7cGFja2FnZU5hbWV9JyB0byBhZGQgaXRgXG59XG5cbmZ1bmN0aW9uIGRldkRlcEVycm9yTWVzc2FnZShwYWNrYWdlTmFtZSkge1xuICByZXR1cm4gYCcke3BhY2thZ2VOYW1lfScgc2hvdWxkIGJlIGxpc3RlZCBpbiB0aGUgcHJvamVjdCdzIGRlcGVuZGVuY2llcywgbm90IGRldkRlcGVuZGVuY2llcy5gXG59XG5cbmZ1bmN0aW9uIG9wdERlcEVycm9yTWVzc2FnZShwYWNrYWdlTmFtZSkge1xuICByZXR1cm4gYCcke3BhY2thZ2VOYW1lfScgc2hvdWxkIGJlIGxpc3RlZCBpbiB0aGUgcHJvamVjdCdzIGRlcGVuZGVuY2llcywgYCArXG4gICAgYG5vdCBvcHRpb25hbERlcGVuZGVuY2llcy5gXG59XG5cbmZ1bmN0aW9uIHJlcG9ydElmTWlzc2luZyhjb250ZXh0LCBkZXBzLCBkZXBzT3B0aW9ucywgbm9kZSwgbmFtZSkge1xuICAvLyBEbyBub3QgcmVwb3J0IHdoZW4gaW1wb3J0aW5nIHR5cGVzXG4gIGlmIChub2RlLmltcG9ydEtpbmQgPT09ICd0eXBlJykge1xuICAgIHJldHVyblxuICB9XG5cbiAgaWYgKGltcG9ydFR5cGUobmFtZSwgY29udGV4dCkgIT09ICdleHRlcm5hbCcpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZShuYW1lLCBjb250ZXh0KVxuICBpZiAoIXJlc29sdmVkKSB7IHJldHVybiB9XG5cbiAgY29uc3Qgc3BsaXROYW1lID0gbmFtZS5zcGxpdCgnLycpXG4gIGNvbnN0IHBhY2thZ2VOYW1lID0gc3BsaXROYW1lWzBdWzBdID09PSAnQCdcbiAgICA/IHNwbGl0TmFtZS5zbGljZSgwLCAyKS5qb2luKCcvJylcbiAgICA6IHNwbGl0TmFtZVswXVxuICBjb25zdCBpc0luRGVwcyA9IGRlcHMuZGVwZW5kZW5jaWVzW3BhY2thZ2VOYW1lXSAhPT0gdW5kZWZpbmVkXG4gIGNvbnN0IGlzSW5EZXZEZXBzID0gZGVwcy5kZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdICE9PSB1bmRlZmluZWRcbiAgY29uc3QgaXNJbk9wdERlcHMgPSBkZXBzLm9wdGlvbmFsRGVwZW5kZW5jaWVzW3BhY2thZ2VOYW1lXSAhPT0gdW5kZWZpbmVkXG4gIGNvbnN0IGlzSW5QZWVyRGVwcyA9IGRlcHMucGVlckRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV0gIT09IHVuZGVmaW5lZFxuICBjb25zdCBpc0luQnVuZGxlZERlcHMgPSBkZXBzLmJ1bmRsZWREZXBlbmRlbmNpZXMuaW5kZXhPZihwYWNrYWdlTmFtZSkgIT09IC0xXG5cbiAgaWYgKGlzSW5EZXBzIHx8XG4gICAgKGRlcHNPcHRpb25zLmFsbG93RGV2RGVwcyAmJiBpc0luRGV2RGVwcykgfHxcbiAgICAoZGVwc09wdGlvbnMuYWxsb3dQZWVyRGVwcyAmJiBpc0luUGVlckRlcHMpIHx8XG4gICAgKGRlcHNPcHRpb25zLmFsbG93T3B0RGVwcyAmJiBpc0luT3B0RGVwcykgfHxcbiAgICAoZGVwc09wdGlvbnMuYWxsb3dCdW5kbGVkRGVwcyAmJiBpc0luQnVuZGxlZERlcHMpXG4gICkge1xuICAgIHJldHVyblxuICB9XG5cbiAgaWYgKGlzSW5EZXZEZXBzICYmICFkZXBzT3B0aW9ucy5hbGxvd0RldkRlcHMpIHtcbiAgICBjb250ZXh0LnJlcG9ydChub2RlLCBkZXZEZXBFcnJvck1lc3NhZ2UocGFja2FnZU5hbWUpKVxuICAgIHJldHVyblxuICB9XG5cbiAgaWYgKGlzSW5PcHREZXBzICYmICFkZXBzT3B0aW9ucy5hbGxvd09wdERlcHMpIHtcbiAgICBjb250ZXh0LnJlcG9ydChub2RlLCBvcHREZXBFcnJvck1lc3NhZ2UocGFja2FnZU5hbWUpKVxuICAgIHJldHVyblxuICB9XG5cbiAgY29udGV4dC5yZXBvcnQobm9kZSwgbWlzc2luZ0Vycm9yTWVzc2FnZShwYWNrYWdlTmFtZSkpXG59XG5cbmZ1bmN0aW9uIHRlc3RDb25maWcoY29uZmlnLCBmaWxlbmFtZSkge1xuICAvLyBTaW1wbGVzdCBjb25maWd1cmF0aW9uIGZpcnN0LCBlaXRoZXIgYSBib29sZWFuIG9yIG5vdGhpbmcuXG4gIGlmICh0eXBlb2YgY29uZmlnID09PSAnYm9vbGVhbicgfHwgdHlwZW9mIGNvbmZpZyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gY29uZmlnXG4gIH1cbiAgLy8gQXJyYXkgb2YgZ2xvYnMuXG4gIHJldHVybiBjb25maWcuc29tZShjID0+IChcbiAgICBtaW5pbWF0Y2goZmlsZW5hbWUsIGMpIHx8XG4gICAgbWluaW1hdGNoKGZpbGVuYW1lLCBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgYykpXG4gICkpXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgdHlwZTogJ3Byb2JsZW0nLFxuICAgIGRvY3M6IHtcbiAgICAgIHVybDogZG9jc1VybCgnbm8tZXh0cmFuZW91cy1kZXBlbmRlbmNpZXMnKSxcbiAgICB9LFxuXG4gICAgc2NoZW1hOiBbXG4gICAgICB7XG4gICAgICAgICd0eXBlJzogJ29iamVjdCcsXG4gICAgICAgICdwcm9wZXJ0aWVzJzoge1xuICAgICAgICAgICdkZXZEZXBlbmRlbmNpZXMnOiB7ICd0eXBlJzogWydib29sZWFuJywgJ2FycmF5J10gfSxcbiAgICAgICAgICAnb3B0aW9uYWxEZXBlbmRlbmNpZXMnOiB7ICd0eXBlJzogWydib29sZWFuJywgJ2FycmF5J10gfSxcbiAgICAgICAgICAncGVlckRlcGVuZGVuY2llcyc6IHsgJ3R5cGUnOiBbJ2Jvb2xlYW4nLCAnYXJyYXknXSB9LFxuICAgICAgICAgICdidW5kbGVkRGVwZW5kZW5jaWVzJzogeyAndHlwZSc6IFsnYm9vbGVhbicsICdhcnJheSddIH0sXG4gICAgICAgICAgJ3BhY2thZ2VEaXInOiB7ICd0eXBlJzogWydzdHJpbmcnLCAnYXJyYXknXSB9LFxuICAgICAgICB9LFxuICAgICAgICAnYWRkaXRpb25hbFByb3BlcnRpZXMnOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcblxuICBjcmVhdGU6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGNvbnRleHQub3B0aW9uc1swXSB8fCB7fVxuICAgIGNvbnN0IGZpbGVuYW1lID0gY29udGV4dC5nZXRGaWxlbmFtZSgpXG4gICAgY29uc3QgZGVwcyA9IGdldERlcGVuZGVuY2llcyhjb250ZXh0LCBvcHRpb25zLnBhY2thZ2VEaXIpIHx8IGV4dHJhY3REZXBGaWVsZHMoe30pXG5cbiAgICBjb25zdCBkZXBzT3B0aW9ucyA9IHtcbiAgICAgIGFsbG93RGV2RGVwczogdGVzdENvbmZpZyhvcHRpb25zLmRldkRlcGVuZGVuY2llcywgZmlsZW5hbWUpICE9PSBmYWxzZSxcbiAgICAgIGFsbG93T3B0RGVwczogdGVzdENvbmZpZyhvcHRpb25zLm9wdGlvbmFsRGVwZW5kZW5jaWVzLCBmaWxlbmFtZSkgIT09IGZhbHNlLFxuICAgICAgYWxsb3dQZWVyRGVwczogdGVzdENvbmZpZyhvcHRpb25zLnBlZXJEZXBlbmRlbmNpZXMsIGZpbGVuYW1lKSAhPT0gZmFsc2UsXG4gICAgICBhbGxvd0J1bmRsZWREZXBzOiB0ZXN0Q29uZmlnKG9wdGlvbnMuYnVuZGxlZERlcGVuZGVuY2llcywgZmlsZW5hbWUpICE9PSBmYWxzZSxcbiAgICB9XG5cbiAgICAvLyB0b2RvOiB1c2UgbW9kdWxlIHZpc2l0b3IgZnJvbSBtb2R1bGUtdXRpbHMgY29yZVxuICAgIHJldHVybiB7XG4gICAgICBJbXBvcnREZWNsYXJhdGlvbjogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgcmVwb3J0SWZNaXNzaW5nKGNvbnRleHQsIGRlcHMsIGRlcHNPcHRpb25zLCBub2RlLCBub2RlLnNvdXJjZS52YWx1ZSlcbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbjogZnVuY3Rpb24gaGFuZGxlUmVxdWlyZXMobm9kZSkge1xuICAgICAgICBpZiAoaXNTdGF0aWNSZXF1aXJlKG5vZGUpKSB7XG4gICAgICAgICAgcmVwb3J0SWZNaXNzaW5nKGNvbnRleHQsIGRlcHMsIGRlcHNPcHRpb25zLCBub2RlLCBub2RlLmFyZ3VtZW50c1swXS52YWx1ZSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=