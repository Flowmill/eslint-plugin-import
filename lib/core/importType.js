"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.isAbsolute = isAbsolute;
exports.isBuiltIn = isBuiltIn;
exports.isExternalModuleMain = isExternalModuleMain;
exports.isScopedMain = isScopedMain;
exports.default = resolveImportType;

var _core = require("resolve/lib/core");

var _core2 = _interopRequireDefault(_core);

var _path = require("path");

var _resolve = require("eslint-module-utils/resolve");

var _resolve2 = _interopRequireDefault(_resolve);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function baseModule(name) {
  if (isScoped(name)) {
    var _name$split = name.split("/"),
        _name$split2 = _slicedToArray(_name$split, 2);

    const scope = _name$split2[0],
          pkg = _name$split2[1];

    return `${scope}/${pkg}`;
  }

  var _name$split3 = name.split("/"),
      _name$split4 = _slicedToArray(_name$split3, 1);

  const pkg = _name$split4[0];

  return pkg;
}

function isAbsolute(name) {
  return name.indexOf("/") === 0;
}

// path is defined only when a resolver resolves to a non-standard path
function isBuiltIn(name, settings, path) {
  if (path) return false;
  const base = baseModule(name);
  const extras = settings && settings["import/core-modules"] || [];
  return _core2.default[base] || extras.indexOf(base) > -1;
}

function isExternalPath(path, name, settings) {
  const folders = settings && settings["import/external-module-folders"] || ["node_modules"];

  // extract the part before the first / (redux-saga/effects => redux-saga)
  const packageName = name.match(/([^/]+)/)[0];

  return !path || folders.some(folder => -1 < path.indexOf((0, _path.join)(folder, packageName)));
}

const externalModuleRegExp = /^\w/;
function isExternalModule(name, settings, path) {
  return externalModuleRegExp.test(name) && isExternalPath(path, name, settings);
}

const externalModuleMainRegExp = /^[\w]((?!\/).)*$/;
function isExternalModuleMain(name, settings, path) {
  return externalModuleMainRegExp.test(name) && isExternalPath(path, name, settings);
}

const scopedRegExp = /^@[^/]+\/[^/]+/;
function isScoped(name) {
  return scopedRegExp.test(name);
}

const scopedMainRegExp = /^@[^/]+\/?[^/]+$/;
function isScopedMain(name) {
  return scopedMainRegExp.test(name);
}

const scopedRootRegExp = /^@\/[^/]+/;
function isScopedRoot(name) {
  return scopedRootRegExp.test(name);
}

function isInternalModule(name, settings, path) {
  const matchesScopedOrExternalRegExp = scopedRegExp.test(name) || externalModuleRegExp.test(name);
  return matchesScopedOrExternalRegExp && !isExternalPath(path, name, settings);
}

function isRelativeToParent(name) {
  return (/^\.\.[\\/]/.test(name)
  );
}

const indexFiles = [".", "./", "./index", "./index.js"];
function isIndex(name) {
  return indexFiles.indexOf(name) !== -1;
}

function isRelativeToSibling(name) {
  return (/^\.[\\/]/.test(name)
  );
}

function typeTest(name, settings, path) {
  if (isAbsolute(name, settings, path)) {
    return "absolute";
  }
  if (isBuiltIn(name, settings, path)) {
    return "builtin";
  }
  if (isInternalModule(name, settings, path)) {
    return "internal";
  }
  if (isExternalModule(name, settings, path)) {
    return "external";
  }
  if (isScoped(name, settings, path)) {
    return "external";
  }
  if (isScopedRoot(name, settings, path)) {
    return "internal";
  }
  if (isRelativeToParent(name, settings, path)) {
    return "parent";
  }
  if (isIndex(name, settings, path)) {
    return "index";
  }
  if (isRelativeToSibling(name, settings, path)) {
    return "sibling";
  }
  return "unknown";
}

function resolveImportType(name, context) {
  return typeTest(name, context.settings, (0, _resolve2.default)(name, context));
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL2ltcG9ydFR5cGUuanMiXSwibmFtZXMiOlsiaXNBYnNvbHV0ZSIsImlzQnVpbHRJbiIsImlzRXh0ZXJuYWxNb2R1bGVNYWluIiwiaXNTY29wZWRNYWluIiwicmVzb2x2ZUltcG9ydFR5cGUiLCJiYXNlTW9kdWxlIiwibmFtZSIsImlzU2NvcGVkIiwic3BsaXQiLCJzY29wZSIsInBrZyIsImluZGV4T2YiLCJzZXR0aW5ncyIsInBhdGgiLCJiYXNlIiwiZXh0cmFzIiwiY29yZU1vZHVsZXMiLCJpc0V4dGVybmFsUGF0aCIsImZvbGRlcnMiLCJwYWNrYWdlTmFtZSIsIm1hdGNoIiwic29tZSIsImZvbGRlciIsImV4dGVybmFsTW9kdWxlUmVnRXhwIiwiaXNFeHRlcm5hbE1vZHVsZSIsInRlc3QiLCJleHRlcm5hbE1vZHVsZU1haW5SZWdFeHAiLCJzY29wZWRSZWdFeHAiLCJzY29wZWRNYWluUmVnRXhwIiwic2NvcGVkUm9vdFJlZ0V4cCIsImlzU2NvcGVkUm9vdCIsImlzSW50ZXJuYWxNb2R1bGUiLCJtYXRjaGVzU2NvcGVkT3JFeHRlcm5hbFJlZ0V4cCIsImlzUmVsYXRpdmVUb1BhcmVudCIsImluZGV4RmlsZXMiLCJpc0luZGV4IiwiaXNSZWxhdGl2ZVRvU2libGluZyIsInR5cGVUZXN0IiwiY29udGV4dCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7UUFjZ0JBLFUsR0FBQUEsVTtRQUtBQyxTLEdBQUFBLFM7UUE2QkFDLG9CLEdBQUFBLG9CO1FBWUFDLFksR0FBQUEsWTtrQkEyRFFDLGlCOztBQXZIeEI7Ozs7QUFDQTs7QUFFQTs7Ozs7O0FBRUEsU0FBU0MsVUFBVCxDQUFvQkMsSUFBcEIsRUFBMEI7QUFDeEIsTUFBSUMsU0FBU0QsSUFBVCxDQUFKLEVBQW9CO0FBQUEsc0JBQ0dBLEtBQUtFLEtBQUwsQ0FBVyxHQUFYLENBREg7QUFBQTs7QUFBQSxVQUNYQyxLQURXO0FBQUEsVUFDSkMsR0FESTs7QUFFbEIsV0FBUSxHQUFFRCxLQUFN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LEVBQXdCQyxJQUF4QixDQUFKLEVBQW1DO0FBQ2pDLFdBQU8sT0FBUDtBQUNEO0FBQ0QsTUFBSXVCLG9CQUFvQjlCLElBQXBCLEVBQTBCTSxRQUExQixFQUFvQ0MsSUFBcEMsQ0FBSixFQUErQztBQUM3QyxXQUFPLFNBQVA7QUFDRDtBQUNELFNBQU8sU0FBUDtBQUNEOztBQUVjLFNBQVNULGlCQUFULENBQTJCRSxJQUEzQixFQUFpQ2dDLE9BQWpDLEVBQTBDO0FBQ3ZELFNBQU9ELFNBQVMvQixJQUFULEVBQWVnQyxRQUFRMUIsUUFBdkIsRUFBaUMsdUJBQVFOLElBQVIsRUFBY2dDLE9BQWQsQ0FBakMsQ0FBUDtBQUNEIiwiZmlsZSI6ImltcG9ydFR5cGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY29yZU1vZHVsZXMgZnJvbSBcInJlc29sdmUvbGliL2NvcmVcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwicGF0aFwiO1xuXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwiZXNsaW50LW1vZHVsZS11dGlscy9yZXNvbHZlXCI7XG5cbmZ1bmN0aW9uIGJhc2VNb2R1bGUobmFtZSkge1xuICBpZiAoaXNTY29wZWQobmFtZSkpIHtcbiAgICBjb25zdCBbc2NvcGUsIHBrZ10gPSBuYW1lLnNwbGl0KFwiL1wiKTtcbiAgICByZXR1cm4gYCR7c2NvcGV9LyR7cGtnfWA7XG4gIH1cbiAgY29uc3QgW3BrZ10gPSBuYW1lLnNwbGl0KFwiL1wiKTtcbiAgcmV0dXJuIHBrZztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQWJzb2x1dGUobmFtZSkge1xuICByZXR1cm4gbmFtZS5pbmRleE9mKFwiL1wiKSA9PT0gMDtcbn1cblxuLy8gcGF0aCBpcyBkZWZpbmVkIG9ubHkgd2hlbiBhIHJlc29sdmVyIHJlc29sdmVzIHRvIGEgbm9uLXN0YW5kYXJkIHBhdGhcbmV4cG9ydCBmdW5jdGlvbiBpc0J1aWx0SW4obmFtZSwgc2V0dGluZ3MsIHBhdGgpIHtcbiAgaWYgKHBhdGgpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgYmFzZSA9IGJhc2VNb2R1bGUobmFtZSk7XG4gIGNvbnN0IGV4dHJhcyA9IChzZXR0aW5ncyAmJiBzZXR0aW5nc1tcImltcG9ydC9jb3JlLW1vZHVsZXNcIl0pIHx8IFtdO1xuICByZXR1cm4gY29yZU1vZHVsZXNbYmFzZV0gfHwgZXh0cmFzLmluZGV4T2YoYmFzZSkgPiAtMTtcbn1cblxuZnVuY3Rpb24gaXNFeHRlcm5hbFBhdGgocGF0aCwgbmFtZSwgc2V0dGluZ3MpIHtcbiAgY29uc3QgZm9sZGVycyA9IChzZXR0aW5ncyAmJiBzZXR0aW5nc1tcImltcG9ydC9leHRlcm5hbC1tb2R1bGUtZm9sZGVyc1wiXSkgfHwgW1xuICAgIFwibm9kZV9tb2R1bGVzXCJcbiAgXTtcblxuICAvLyBleHRyYWN0IHRoZSBwYXJ0IGJlZm9yZSB0aGUgZmlyc3QgLyAocmVkdXgtc2FnYS9lZmZlY3RzID0+IHJlZHV4LXNhZ2EpXG4gIGNvbnN0IHBhY2thZ2VOYW1lID0gbmFtZS5tYXRjaCgvKFteL10rKS8pWzBdO1xuXG4gIHJldHVybiAoXG4gICAgIXBhdGggfHxcbiAgICBmb2xkZXJzLnNvbWUoZm9sZGVyID0+IC0xIDwgcGF0aC5pbmRleE9mKGpvaW4oZm9sZGVyLCBwYWNrYWdlTmFtZSkpKVxuICApO1xufVxuXG5jb25zdCBleHRlcm5hbE1vZHVsZVJlZ0V4cCA9IC9eXFx3LztcbmZ1bmN0aW9uIGlzRXh0ZXJuYWxNb2R1bGUobmFtZSwgc2V0dGluZ3MsIHBhdGgpIHtcbiAgcmV0dXJuIChcbiAgICBleHRlcm5hbE1vZHVsZVJlZ0V4cC50ZXN0KG5hbWUpICYmIGlzRXh0ZXJuYWxQYXRoKHBhdGgsIG5hbWUsIHNldHRpbmdzKVxuICApO1xufVxuXG5jb25zdCBleHRlcm5hbE1vZHVsZU1haW5SZWdFeHAgPSAvXltcXHddKCg/IVxcLykuKSokLztcbmV4cG9ydCBmdW5jdGlvbiBpc0V4dGVybmFsTW9kdWxlTWFpbihuYW1lLCBzZXR0aW5ncywgcGF0aCkge1xuICByZXR1cm4gKFxuICAgIGV4dGVybmFsTW9kdWxlTWFpblJlZ0V4cC50ZXN0KG5hbWUpICYmIGlzRXh0ZXJuYWxQYXRoKHBhdGgsIG5hbWUsIHNldHRpbmdzKVxuICApO1xufVxuXG5jb25zdCBzY29wZWRSZWdFeHAgPSAvXkBbXi9dK1xcL1teL10rLztcbmZ1bmN0aW9uIGlzU2NvcGVkKG5hbWUpIHtcbiAgcmV0dXJuIHNjb3BlZFJlZ0V4cC50ZXN0KG5hbWUpO1xufVxuXG5jb25zdCBzY29wZWRNYWluUmVnRXhwID0gL15AW14vXStcXC8/W14vXSskLztcbmV4cG9ydCBmdW5jdGlvbiBpc1Njb3BlZE1haW4obmFtZSkge1xuICByZXR1cm4gc2NvcGVkTWFpblJlZ0V4cC50ZXN0KG5hbWUpO1xufVxuXG5jb25zdCBzY29wZWRSb290UmVnRXhwID0gL15AXFwvW14vXSsvO1xuZnVuY3Rpb24gaXNTY29wZWRSb290KG5hbWUpIHtcbiAgcmV0dXJuIHNjb3BlZFJvb3RSZWdFeHAudGVzdChuYW1lKTtcbn1cblxuZnVuY3Rpb24gaXNJbnRlcm5hbE1vZHVsZShuYW1lLCBzZXR0aW5ncywgcGF0aCkge1xuICBjb25zdCBtYXRjaGVzU2NvcGVkT3JFeHRlcm5hbFJlZ0V4cCA9XG4gICAgc2NvcGVkUmVnRXhwLnRlc3QobmFtZSkgfHwgZXh0ZXJuYWxNb2R1bGVSZWdFeHAudGVzdChuYW1lKTtcbiAgcmV0dXJuIG1hdGNoZXNTY29wZWRPckV4dGVybmFsUmVnRXhwICYmICFpc0V4dGVybmFsUGF0aChwYXRoLCBuYW1lLCBzZXR0aW5ncyk7XG59XG5cbmZ1bmN0aW9uIGlzUmVsYXRpdmVUb1BhcmVudChuYW1lKSB7XG4gIHJldHVybiAvXlxcLlxcLltcXFxcL10vLnRlc3QobmFtZSk7XG59XG5cbmNvbnN0IGluZGV4RmlsZXMgPSBbXCIuXCIsIFwiLi9cIiwgXCIuL2luZGV4XCIsIFwiLi9pbmRleC5qc1wiXTtcbmZ1bmN0aW9uIGlzSW5kZXgobmFtZSkge1xuICByZXR1cm4gaW5kZXhGaWxlcy5pbmRleE9mKG5hbWUpICE9PSAtMTtcbn1cblxuZnVuY3Rpb24gaXNSZWxhdGl2ZVRvU2libGluZyhuYW1lKSB7XG4gIHJldHVybiAvXlxcLltcXFxcL10vLnRlc3QobmFtZSk7XG59XG5cbmZ1bmN0aW9uIHR5cGVUZXN0KG5hbWUsIHNldHRpbmdzLCBwYXRoKSB7XG4gIGlmIChpc0Fic29sdXRlKG5hbWUsIHNldHRpbmdzLCBwYXRoKSkge1xuICAgIHJldHVybiBcImFic29sdXRlXCI7XG4gIH1cbiAgaWYgKGlzQnVpbHRJbihuYW1lLCBzZXR0aW5ncywgcGF0aCkpIHtcbiAgICByZXR1cm4gXCJidWlsdGluXCI7XG4gIH1cbiAgaWYgKGlzSW50ZXJuYWxNb2R1bGUobmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwiaW50ZXJuYWxcIjtcbiAgfVxuICBpZiAoaXNFeHRlcm5hbE1vZHVsZShuYW1lLCBzZXR0aW5ncywgcGF0aCkpIHtcbiAgICByZXR1cm4gXCJleHRlcm5hbFwiO1xuICB9XG4gIGlmIChpc1Njb3BlZChuYW1lLCBzZXR0aW5ncywgcGF0aCkpIHtcbiAgICByZXR1cm4gXCJleHRlcm5hbFwiO1xuICB9XG4gIGlmIChpc1Njb3BlZFJvb3QobmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwiaW50ZXJuYWxcIjtcbiAgfVxuICBpZiAoaXNSZWxhdGl2ZVRvUGFyZW50KG5hbWUsIHNldHRpbmdzLCBwYXRoKSkge1xuICAgIHJldHVybiBcInBhcmVudFwiO1xuICB9XG4gIGlmIChpc0luZGV4KG5hbWUsIHNldHRpbmdzLCBwYXRoKSkge1xuICAgIHJldHVybiBcImluZGV4XCI7XG4gIH1cbiAgaWYgKGlzUmVsYXRpdmVUb1NpYmxpbmcobmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwic2libGluZ1wiO1xuICB9XG4gIHJldHVybiBcInVua25vd25cIjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVzb2x2ZUltcG9ydFR5cGUobmFtZSwgY29udGV4dCkge1xuICByZXR1cm4gdHlwZVRlc3QobmFtZSwgY29udGV4dC5zZXR0aW5ncywgcmVzb2x2ZShuYW1lLCBjb250ZXh0KSk7XG59XG4iXX0=