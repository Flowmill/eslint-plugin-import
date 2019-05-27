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

var _cond = require("lodash/cond");

var _cond2 = _interopRequireDefault(_cond);

var _core = require("resolve/lib/core");

var _core2 = _interopRequireDefault(_core);

var _path = require("path");

var _resolve = require("eslint-module-utils/resolve");

var _resolve2 = _interopRequireDefault(_resolve);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function constant(value) {
  return () => value;
}

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

const scopedRegExp = /^@[^/]*\/[^/]+/;
function isScoped(name) {
  return scopedRegExp.test(name);
}

const scopedMainRegExp = /^@[^/]*\/?[^/]+$/;
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

const typeTest = (0, _cond2.default)([[isAbsolute, constant("absolute")], [isBuiltIn, constant("builtin")], [isInternalModule, constant("internal")], [isExternalModule, constant("external")], [isScoped, constant("internal")], [isRelativeToParent, constant("parent")], [isIndex, constant("index")], [isRelativeToSibling, constant("sibling")], [constant(true), constant("unknown")]]);

function resolveImportType(name, context) {
  return typeTest(name, context.settings, (0, _resolve2.default)(name, context));
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUvaW1wb3J0VHlwZS5qcyJdLCJuYW1lcyI6WyJpc0Fic29sdXRlIiwiaXNCdWlsdEluIiwiaXNFeHRlcm5hbE1vZHVsZU1haW4iLCJpc1Njb3BlZE1haW4iLCJyZXNvbHZlSW1wb3J0VHlwZSIsImNvbnN0YW50IiwidmFsdWUiLCJiYXNlTW9kdWxlIiwibmFtZSIsImlzU2NvcGVkIiwic3BsaXQiLCJzY29wZSIsInBrZyIsImluZGV4T2YiLCJzZXR0aW5ncyIsInBhdGgiLCJiYXNlIiwiZXh0cmFzIiwiY29yZU1vZHVsZXMiLCJpc0V4dGVybmFsUGF0aCIsImZvbGRlcnMiLCJwYWNrYWdlTmFtZSIsIm1hdGNoIiwic29tZSIsImZvbGRlciIsImV4dGVybmFsTW9kdWxlUmVnRXhwIiwiaXNFeHRlcm5hbE1vZHVsZSIsInRlc3QiLCJleHRlcm5hbE1vZHVsZU1haW5SZWdFeHAiLCJzY29wZWRSZWdFeHAiLCJzY29wZWRNYWluUmVnRXhwIiwiaXNJbnRlcm5hbE1vZHVsZSIsIm1hdGNoZXNTY29wZWRPckV4dGVybmFsUmVnRXhwIiwiaXNSZWxhdGl2ZVRvUGFyZW50IiwiaW5kZXhGaWxlcyIsImlzSW5kZXgiLCJpc1JlbGF0aXZlVG9TaWJsaW5nIiwidHlwZVRlc3QiLCJjb250ZXh0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztRQW1CZ0JBLFUsR0FBQUEsVTtRQUtBQyxTLEdBQUFBLFM7UUE2QkFDLG9CLEdBQUFBLG9CO1FBWUFDLFksR0FBQUEsWTtrQkFtQ1FDLGlCOztBQXBHeEI7Ozs7QUFDQTs7OztBQUNBOztBQUVBOzs7Ozs7QUFFQSxTQUFTQyxRQUFULENBQWtCQyxLQUFsQixFQUF5QjtBQUN2QixTQUFPLE1BQU1BLEtBQWI7QUFDRDs7QUFFRCxTQUFTQyxVQUFULENBQW9CQyxJQUFwQixFQUEwQjtBQUN4QixNQUFJQyxTQUFTRCxJQUFULENBQUosRUFBb0I7QUFBQSxzQkFDR0EsS0FBS0UsS0FBTCxDQUFXLEdBQVgsQ0FESDtBQUFBOztBQUFBLFVB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M0IsSUFBakIsRUFBdUI7QUFDckIsU0FBTzBCLFdBQVdyQixPQUFYLENBQW1CTCxJQUFuQixNQUE2QixDQUFDLENBQXJDO0FBQ0Q7O0FBRUQsU0FBUzRCLG1CQUFULENBQTZCNUIsSUFBN0IsRUFBbUM7QUFDakMsU0FBTyxZQUFXbUIsSUFBWCxDQUFnQm5CLElBQWhCO0FBQVA7QUFDRDs7QUFFRCxNQUFNNkIsV0FBVyxvQkFBSyxDQUNwQixDQUFDckMsVUFBRCxFQUFhSyxTQUFTLFVBQVQsQ0FBYixDQURvQixFQUVwQixDQUFDSixTQUFELEVBQVlJLFNBQVMsU0FBVCxDQUFaLENBRm9CLEVBR3BCLENBQUMwQixnQkFBRCxFQUFtQjFCLFNBQVMsVUFBVCxDQUFuQixDQUhvQixFQUlwQixDQUFDcUIsZ0JBQUQsRUFBbUJyQixTQUFTLFVBQVQsQ0FBbkIsQ0FKb0IsRUFLcEIsQ0FBQ0ksUUFBRCxFQUFXSixTQUFTLFVBQVQsQ0FBWCxDQUxvQixFQU1wQixDQUFDNEIsa0JBQUQsRUFBcUI1QixTQUFTLFFBQVQsQ0FBckIsQ0FOb0IsRUFPcEIsQ0FBQzhCLE9BQUQsRUFBVTlCLFNBQVMsT0FBVCxDQUFWLENBUG9CLEVBUXBCLENBQUMrQixtQkFBRCxFQUFzQi9CLFNBQVMsU0FBVCxDQUF0QixDQVJvQixFQVNwQixDQUFDQSxTQUFTLElBQVQsQ0FBRCxFQUFpQkEsU0FBUyxTQUFULENBQWpCLENBVG9CLENBQUwsQ0FBakI7O0FBWWUsU0FBU0QsaUJBQVQsQ0FBMkJJLElBQTNCLEVBQWlDOEIsT0FBakMsRUFBMEM7QUFDdkQsU0FBT0QsU0FBUzdCLElBQVQsRUFBZThCLFFBQVF4QixRQUF2QixFQUFpQyx1QkFBUU4sSUFBUixFQUFjOEIsT0FBZCxDQUFqQyxDQUFQO0FBQ0QiLCJmaWxlIjoiY29yZS9pbXBvcnRUeXBlLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNvbmQgZnJvbSBcImxvZGFzaC9jb25kXCI7XG5pbXBvcnQgY29yZU1vZHVsZXMgZnJvbSBcInJlc29sdmUvbGliL2NvcmVcIjtcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwicGF0aFwiO1xuXG5pbXBvcnQgcmVzb2x2ZSBmcm9tIFwiZXNsaW50LW1vZHVsZS11dGlscy9yZXNvbHZlXCI7XG5cbmZ1bmN0aW9uIGNvbnN0YW50KHZhbHVlKSB7XG4gIHJldHVybiAoKSA9PiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gYmFzZU1vZHVsZShuYW1lKSB7XG4gIGlmIChpc1Njb3BlZChuYW1lKSkge1xuICAgIGNvbnN0IFtzY29wZSwgcGtnXSA9IG5hbWUuc3BsaXQoXCIvXCIpO1xuICAgIHJldHVybiBgJHtzY29wZX0vJHtwa2d9YDtcbiAgfVxuICBjb25zdCBbcGtnXSA9IG5hbWUuc3BsaXQoXCIvXCIpO1xuICByZXR1cm4gcGtnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNBYnNvbHV0ZShuYW1lKSB7XG4gIHJldHVybiBuYW1lLmluZGV4T2YoXCIvXCIpID09PSAwO1xufVxuXG4vLyBwYXRoIGlzIGRlZmluZWQgb25seSB3aGVuIGEgcmVzb2x2ZXIgcmVzb2x2ZXMgdG8gYSBub24tc3RhbmRhcmQgcGF0aFxuZXhwb3J0IGZ1bmN0aW9uIGlzQnVpbHRJbihuYW1lLCBzZXR0aW5ncywgcGF0aCkge1xuICBpZiAocGF0aCkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBiYXNlID0gYmFzZU1vZHVsZShuYW1lKTtcbiAgY29uc3QgZXh0cmFzID0gKHNldHRpbmdzICYmIHNldHRpbmdzW1wiaW1wb3J0L2NvcmUtbW9kdWxlc1wiXSkgfHwgW107XG4gIHJldHVybiBjb3JlTW9kdWxlc1tiYXNlXSB8fCBleHRyYXMuaW5kZXhPZihiYXNlKSA+IC0xO1xufVxuXG5mdW5jdGlvbiBpc0V4dGVybmFsUGF0aChwYXRoLCBuYW1lLCBzZXR0aW5ncykge1xuICBjb25zdCBmb2xkZXJzID0gKHNldHRpbmdzICYmIHNldHRpbmdzW1wiaW1wb3J0L2V4dGVybmFsLW1vZHVsZS1mb2xkZXJzXCJdKSB8fCBbXG4gICAgXCJub2RlX21vZHVsZXNcIlxuICBdO1xuXG4gIC8vIGV4dHJhY3QgdGhlIHBhcnQgYmVmb3JlIHRoZSBmaXJzdCAvIChyZWR1eC1zYWdhL2VmZmVjdHMgPT4gcmVkdXgtc2FnYSlcbiAgY29uc3QgcGFja2FnZU5hbWUgPSBuYW1lLm1hdGNoKC8oW14vXSspLylbMF07XG5cbiAgcmV0dXJuIChcbiAgICAhcGF0aCB8fFxuICAgIGZvbGRlcnMuc29tZShmb2xkZXIgPT4gLTEgPCBwYXRoLmluZGV4T2Yoam9pbihmb2xkZXIsIHBhY2thZ2VOYW1lKSkpXG4gICk7XG59XG5cbmNvbnN0IGV4dGVybmFsTW9kdWxlUmVnRXhwID0gL15cXHcvO1xuZnVuY3Rpb24gaXNFeHRlcm5hbE1vZHVsZShuYW1lLCBzZXR0aW5ncywgcGF0aCkge1xuICByZXR1cm4gKFxuICAgIGV4dGVybmFsTW9kdWxlUmVnRXhwLnRlc3QobmFtZSkgJiYgaXNFeHRlcm5hbFBhdGgocGF0aCwgbmFtZSwgc2V0dGluZ3MpXG4gICk7XG59XG5cbmNvbnN0IGV4dGVybmFsTW9kdWxlTWFpblJlZ0V4cCA9IC9eW1xcd10oKD8hXFwvKS4pKiQvO1xuZXhwb3J0IGZ1bmN0aW9uIGlzRXh0ZXJuYWxNb2R1bGVNYWluKG5hbWUsIHNldHRpbmdzLCBwYXRoKSB7XG4gIHJldHVybiAoXG4gICAgZXh0ZXJuYWxNb2R1bGVNYWluUmVnRXhwLnRlc3QobmFtZSkgJiYgaXNFeHRlcm5hbFBhdGgocGF0aCwgbmFtZSwgc2V0dGluZ3MpXG4gICk7XG59XG5cbmNvbnN0IHNjb3BlZFJlZ0V4cCA9IC9eQFteL10qXFwvW14vXSsvO1xuZnVuY3Rpb24gaXNTY29wZWQobmFtZSkge1xuICByZXR1cm4gc2NvcGVkUmVnRXhwLnRlc3QobmFtZSk7XG59XG5cbmNvbnN0IHNjb3BlZE1haW5SZWdFeHAgPSAvXkBbXi9dKlxcLz9bXi9dKyQvO1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2NvcGVkTWFpbihuYW1lKSB7XG4gIHJldHVybiBzY29wZWRNYWluUmVnRXhwLnRlc3QobmFtZSk7XG59XG5cbmZ1bmN0aW9uIGlzSW50ZXJuYWxNb2R1bGUobmFtZSwgc2V0dGluZ3MsIHBhdGgpIHtcbiAgY29uc3QgbWF0Y2hlc1Njb3BlZE9yRXh0ZXJuYWxSZWdFeHAgPVxuICAgIHNjb3BlZFJlZ0V4cC50ZXN0KG5hbWUpIHx8IGV4dGVybmFsTW9kdWxlUmVnRXhwLnRlc3QobmFtZSk7XG4gIHJldHVybiBtYXRjaGVzU2NvcGVkT3JFeHRlcm5hbFJlZ0V4cCAmJiAhaXNFeHRlcm5hbFBhdGgocGF0aCwgbmFtZSwgc2V0dGluZ3MpO1xufVxuXG5mdW5jdGlvbiBpc1JlbGF0aXZlVG9QYXJlbnQobmFtZSkge1xuICByZXR1cm4gL15cXC5cXC5bXFxcXC9dLy50ZXN0KG5hbWUpO1xufVxuXG5jb25zdCBpbmRleEZpbGVzID0gW1wiLlwiLCBcIi4vXCIsIFwiLi9pbmRleFwiLCBcIi4vaW5kZXguanNcIl07XG5mdW5jdGlvbiBpc0luZGV4KG5hbWUpIHtcbiAgcmV0dXJuIGluZGV4RmlsZXMuaW5kZXhPZihuYW1lKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIGlzUmVsYXRpdmVUb1NpYmxpbmcobmFtZSkge1xuICByZXR1cm4gL15cXC5bXFxcXC9dLy50ZXN0KG5hbWUpO1xufVxuXG5jb25zdCB0eXBlVGVzdCA9IGNvbmQoW1xuICBbaXNBYnNvbHV0ZSwgY29uc3RhbnQoXCJhYnNvbHV0ZVwiKV0sXG4gIFtpc0J1aWx0SW4sIGNvbnN0YW50KFwiYnVpbHRpblwiKV0sXG4gIFtpc0ludGVybmFsTW9kdWxlLCBjb25zdGFudChcImludGVybmFsXCIpXSxcbiAgW2lzRXh0ZXJuYWxNb2R1bGUsIGNvbnN0YW50KFwiZXh0ZXJuYWxcIildLFxuICBbaXNTY29wZWQsIGNvbnN0YW50KFwiaW50ZXJuYWxcIildLFxuICBbaXNSZWxhdGl2ZVRvUGFyZW50LCBjb25zdGFudChcInBhcmVudFwiKV0sXG4gIFtpc0luZGV4LCBjb25zdGFudChcImluZGV4XCIpXSxcbiAgW2lzUmVsYXRpdmVUb1NpYmxpbmcsIGNvbnN0YW50KFwic2libGluZ1wiKV0sXG4gIFtjb25zdGFudCh0cnVlKSwgY29uc3RhbnQoXCJ1bmtub3duXCIpXVxuXSk7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHJlc29sdmVJbXBvcnRUeXBlKG5hbWUsIGNvbnRleHQpIHtcbiAgcmV0dXJuIHR5cGVUZXN0KG5hbWUsIGNvbnRleHQuc2V0dGluZ3MsIHJlc29sdmUobmFtZSwgY29udGV4dCkpO1xufVxuIl19