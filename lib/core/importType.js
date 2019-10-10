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

const scopedRegExp = /^@\/[^/]+/;
function isScoped(name) {
  return scopedRegExp.test(name);
}

const scopedMainRegExp = /^@[^/]+\/?[^/]+$/;
function isScopedMain(name) {
  return scopedMainRegExp.test(name);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9jb3JlL2ltcG9ydFR5cGUuanMiXSwibmFtZXMiOlsiaXNBYnNvbHV0ZSIsImlzQnVpbHRJbiIsImlzRXh0ZXJuYWxNb2R1bGVNYWluIiwiaXNTY29wZWRNYWluIiwicmVzb2x2ZUltcG9ydFR5cGUiLCJiYXNlTW9kdWxlIiwibmFtZSIsImlzU2NvcGVkIiwic3BsaXQiLCJzY29wZSIsInBrZyIsImluZGV4T2YiLCJzZXR0aW5ncyIsInBhdGgiLCJiYXNlIiwiZXh0cmFzIiwiY29yZU1vZHVsZXMiLCJpc0V4dGVybmFsUGF0aCIsImZvbGRlcnMiLCJwYWNrYWdlTmFtZSIsIm1hdGNoIiwic29tZSIsImZvbGRlciIsImV4dGVybmFsTW9kdWxlUmVnRXhwIiwiaXNFeHRlcm5hbE1vZHVsZSIsInRlc3QiLCJleHRlcm5hbE1vZHVsZU1haW5SZWdFeHAiLCJzY29wZWRSZWdFeHAiLCJzY29wZWRNYWluUmVnRXhwIiwiaXNJbnRlcm5hbE1vZHVsZSIsIm1hdGNoZXNTY29wZWRPckV4dGVybmFsUmVnRXhwIiwiaXNSZWxhdGl2ZVRvUGFyZW50IiwiaW5kZXhGaWxlcyIsImlzSW5kZXgiLCJpc1JlbGF0aXZlVG9TaWJsaW5nIiwidHlwZVRlc3QiLCJjb250ZXh0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztRQWNnQkEsVSxHQUFBQSxVO1FBS0FDLFMsR0FBQUEsUztRQTZCQUMsb0IsR0FBQUEsb0I7UUFZQUMsWSxHQUFBQSxZO2tCQW1EUUMsaUI7O0FBL0d4Qjs7OztBQUNBOztBQUVBOzs7Ozs7QUFFQSxTQUFTQyxVQUFULENBQW9CQyxJQUFwQixFQUEwQjtBQUN4QixNQUFJQyxTQUFTRCxJQUFULENBQUosRUFBb0I7QUFBQSxzQkFDR0EsS0FBS0UsS0FBTCxDQUFXLEdBQVgsQ0FESDtBQUFBOztBQUFBLFVBQ1hDLEtBRFc7QUFBQSxVQUNKQyxHQURJOztBQUVsQixXQUFRLEdBQUVELEtBQU0sSUFBR0MsR0FBSSxFQUF2QjtBQUNEOztBQUp1QixxQkFL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OEIsUUFBUXhCLFFBQXZCLEVBQWlDLHVCQUFRTixJQUFSLEVBQWM4QixPQUFkLENBQWpDLENBQVA7QUFDRCIsImZpbGUiOiJpbXBvcnRUeXBlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNvcmVNb2R1bGVzIGZyb20gXCJyZXNvbHZlL2xpYi9jb3JlXCI7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcInBhdGhcIjtcblxuaW1wb3J0IHJlc29sdmUgZnJvbSBcImVzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZVwiO1xuXG5mdW5jdGlvbiBiYXNlTW9kdWxlKG5hbWUpIHtcbiAgaWYgKGlzU2NvcGVkKG5hbWUpKSB7XG4gICAgY29uc3QgW3Njb3BlLCBwa2ddID0gbmFtZS5zcGxpdChcIi9cIik7XG4gICAgcmV0dXJuIGAke3Njb3BlfS8ke3BrZ31gO1xuICB9XG4gIGNvbnN0IFtwa2ddID0gbmFtZS5zcGxpdChcIi9cIik7XG4gIHJldHVybiBwa2c7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0Fic29sdXRlKG5hbWUpIHtcbiAgcmV0dXJuIG5hbWUuaW5kZXhPZihcIi9cIikgPT09IDA7XG59XG5cbi8vIHBhdGggaXMgZGVmaW5lZCBvbmx5IHdoZW4gYSByZXNvbHZlciByZXNvbHZlcyB0byBhIG5vbi1zdGFuZGFyZCBwYXRoXG5leHBvcnQgZnVuY3Rpb24gaXNCdWlsdEluKG5hbWUsIHNldHRpbmdzLCBwYXRoKSB7XG4gIGlmIChwYXRoKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGJhc2UgPSBiYXNlTW9kdWxlKG5hbWUpO1xuICBjb25zdCBleHRyYXMgPSAoc2V0dGluZ3MgJiYgc2V0dGluZ3NbXCJpbXBvcnQvY29yZS1tb2R1bGVzXCJdKSB8fCBbXTtcbiAgcmV0dXJuIGNvcmVNb2R1bGVzW2Jhc2VdIHx8IGV4dHJhcy5pbmRleE9mKGJhc2UpID4gLTE7XG59XG5cbmZ1bmN0aW9uIGlzRXh0ZXJuYWxQYXRoKHBhdGgsIG5hbWUsIHNldHRpbmdzKSB7XG4gIGNvbnN0IGZvbGRlcnMgPSAoc2V0dGluZ3MgJiYgc2V0dGluZ3NbXCJpbXBvcnQvZXh0ZXJuYWwtbW9kdWxlLWZvbGRlcnNcIl0pIHx8IFtcbiAgICBcIm5vZGVfbW9kdWxlc1wiXG4gIF07XG5cbiAgLy8gZXh0cmFjdCB0aGUgcGFydCBiZWZvcmUgdGhlIGZpcnN0IC8gKHJlZHV4LXNhZ2EvZWZmZWN0cyA9PiByZWR1eC1zYWdhKVxuICBjb25zdCBwYWNrYWdlTmFtZSA9IG5hbWUubWF0Y2goLyhbXi9dKykvKVswXTtcblxuICByZXR1cm4gKFxuICAgICFwYXRoIHx8XG4gICAgZm9sZGVycy5zb21lKGZvbGRlciA9PiAtMSA8IHBhdGguaW5kZXhPZihqb2luKGZvbGRlciwgcGFja2FnZU5hbWUpKSlcbiAgKTtcbn1cblxuY29uc3QgZXh0ZXJuYWxNb2R1bGVSZWdFeHAgPSAvXlxcdy87XG5mdW5jdGlvbiBpc0V4dGVybmFsTW9kdWxlKG5hbWUsIHNldHRpbmdzLCBwYXRoKSB7XG4gIHJldHVybiAoXG4gICAgZXh0ZXJuYWxNb2R1bGVSZWdFeHAudGVzdChuYW1lKSAmJiBpc0V4dGVybmFsUGF0aChwYXRoLCBuYW1lLCBzZXR0aW5ncylcbiAgKTtcbn1cblxuY29uc3QgZXh0ZXJuYWxNb2R1bGVNYWluUmVnRXhwID0gL15bXFx3XSgoPyFcXC8pLikqJC87XG5leHBvcnQgZnVuY3Rpb24gaXNFeHRlcm5hbE1vZHVsZU1haW4obmFtZSwgc2V0dGluZ3MsIHBhdGgpIHtcbiAgcmV0dXJuIChcbiAgICBleHRlcm5hbE1vZHVsZU1haW5SZWdFeHAudGVzdChuYW1lKSAmJiBpc0V4dGVybmFsUGF0aChwYXRoLCBuYW1lLCBzZXR0aW5ncylcbiAgKTtcbn1cblxuY29uc3Qgc2NvcGVkUmVnRXhwID0gL15AXFwvW14vXSsvO1xuZnVuY3Rpb24gaXNTY29wZWQobmFtZSkge1xuICByZXR1cm4gc2NvcGVkUmVnRXhwLnRlc3QobmFtZSk7XG59XG5cbmNvbnN0IHNjb3BlZE1haW5SZWdFeHAgPSAvXkBbXi9dK1xcLz9bXi9dKyQvO1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2NvcGVkTWFpbihuYW1lKSB7XG4gIHJldHVybiBzY29wZWRNYWluUmVnRXhwLnRlc3QobmFtZSk7XG59XG5cbmZ1bmN0aW9uIGlzSW50ZXJuYWxNb2R1bGUobmFtZSwgc2V0dGluZ3MsIHBhdGgpIHtcbiAgY29uc3QgbWF0Y2hlc1Njb3BlZE9yRXh0ZXJuYWxSZWdFeHAgPVxuICAgIHNjb3BlZFJlZ0V4cC50ZXN0KG5hbWUpIHx8IGV4dGVybmFsTW9kdWxlUmVnRXhwLnRlc3QobmFtZSk7XG4gIHJldHVybiBtYXRjaGVzU2NvcGVkT3JFeHRlcm5hbFJlZ0V4cCAmJiAhaXNFeHRlcm5hbFBhdGgocGF0aCwgbmFtZSwgc2V0dGluZ3MpO1xufVxuXG5mdW5jdGlvbiBpc1JlbGF0aXZlVG9QYXJlbnQobmFtZSkge1xuICByZXR1cm4gL15cXC5cXC5bXFxcXC9dLy50ZXN0KG5hbWUpO1xufVxuXG5jb25zdCBpbmRleEZpbGVzID0gW1wiLlwiLCBcIi4vXCIsIFwiLi9pbmRleFwiLCBcIi4vaW5kZXguanNcIl07XG5mdW5jdGlvbiBpc0luZGV4KG5hbWUpIHtcbiAgcmV0dXJuIGluZGV4RmlsZXMuaW5kZXhPZihuYW1lKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIGlzUmVsYXRpdmVUb1NpYmxpbmcobmFtZSkge1xuICByZXR1cm4gL15cXC5bXFxcXC9dLy50ZXN0KG5hbWUpO1xufVxuXG5mdW5jdGlvbiB0eXBlVGVzdChuYW1lLCBzZXR0aW5ncywgcGF0aCkge1xuICBpZiAoaXNBYnNvbHV0ZShuYW1lLCBzZXR0aW5ncywgcGF0aCkpIHtcbiAgICByZXR1cm4gXCJhYnNvbHV0ZVwiO1xuICB9XG4gIGlmIChpc0J1aWx0SW4obmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwiYnVpbHRpblwiO1xuICB9XG4gIGlmIChpc0ludGVybmFsTW9kdWxlKG5hbWUsIHNldHRpbmdzLCBwYXRoKSkge1xuICAgIHJldHVybiBcImludGVybmFsXCI7XG4gIH1cbiAgaWYgKGlzRXh0ZXJuYWxNb2R1bGUobmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwiZXh0ZXJuYWxcIjtcbiAgfVxuICBpZiAoaXNTY29wZWQobmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwiaW50ZXJuYWxcIjtcbiAgfVxuICBpZiAoaXNSZWxhdGl2ZVRvUGFyZW50KG5hbWUsIHNldHRpbmdzLCBwYXRoKSkge1xuICAgIHJldHVybiBcInBhcmVudFwiO1xuICB9XG4gIGlmIChpc0luZGV4KG5hbWUsIHNldHRpbmdzLCBwYXRoKSkge1xuICAgIHJldHVybiBcImluZGV4XCI7XG4gIH1cbiAgaWYgKGlzUmVsYXRpdmVUb1NpYmxpbmcobmFtZSwgc2V0dGluZ3MsIHBhdGgpKSB7XG4gICAgcmV0dXJuIFwic2libGluZ1wiO1xuICB9XG4gIHJldHVybiBcInVua25vd25cIjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcmVzb2x2ZUltcG9ydFR5cGUobmFtZSwgY29udGV4dCkge1xuICByZXR1cm4gdHlwZVRlc3QobmFtZSwgY29udGV4dC5zZXR0aW5ncywgcmVzb2x2ZShuYW1lLCBjb250ZXh0KSk7XG59XG4iXX0=