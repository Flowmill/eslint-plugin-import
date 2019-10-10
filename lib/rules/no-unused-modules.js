'use strict';

var _ExportMap = require('../ExportMap');

var _ExportMap2 = _interopRequireDefault(_ExportMap);

var _resolve = require('eslint-module-utils/resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

var _path = require('path');

var _readPkgUp = require('read-pkg-up');

var _readPkgUp2 = _interopRequireDefault(_readPkgUp);

var _object = require('object.values');

var _object2 = _interopRequireDefault(_object);

var _arrayIncludes = require('array-includes');

var _arrayIncludes2 = _interopRequireDefault(_arrayIncludes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } } /**
                                                                                                                                                                                                 * @fileOverview Ensures that modules contain exports and/or all
                                                                                                                                                                                                 * modules are consumed within other modules.
                                                                                                                                                                                                 * @author René Fermann
                                                                                                                                                                                                 */

// eslint/lib/util/glob-util has been moved to eslint/lib/util/glob-utils with version 5.3
// and has been moved to eslint/lib/cli-engine/file-enumerator in version 6
let listFilesToProcess;
try {
  var FileEnumerator = require('eslint/lib/cli-engine/file-enumerator').FileEnumerator;
  listFilesToProcess = function (src) {
    var e = new FileEnumerator();
    return Array.from(e.iterateFiles(src), (_ref) => {
      let filePath = _ref.filePath,
          ignored = _ref.ignored;
      return {
        ignored,
        filename: filePath
      };
    });
  };
} catch (e1) {
  try {
    listFilesToProcess = require('eslint/lib/util/glob-utils').listFilesToProcess;
  } catch (e2) {
    listFilesToProcess = require('eslint/lib/util/glob-util').listFilesToProcess;
  }
}

const EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';
const IMPORT_DECLARATION = 'ImportDeclaration';
const IMPORT_NAMESPACE_SPECIFIER = 'ImportNamespaceSpecifier';
const IMPORT_DEFAULT_SPECIFIER = 'ImportDefaultSpecifier';
const VARIABLE_DECLARATION = 'VariableDeclaration';
const FUNCTION_DECLARATION = 'FunctionDeclaration';
const CLASS_DECLARATION = 'ClassDeclaration';
const DEFAULT = 'default';

let preparationDone = false;
const importList = new Map();
const exportList = new Map();
const ignoredFiles = new Set();
const filesOutsideSrc = new Set();

const isNodeModule = path => {
  return (/\/(node_modules)\//.test(path)
  );
};

/**
 * read all files matching the patterns in src and ignoreExports
 *
 * return all files matching src pattern, which are not matching the ignoreExports pattern
 */
const resolveFiles = (src, ignoreExports) => {
  const srcFiles = new Set();
  const srcFileList = listFilesToProcess(src);

  // prepare list of ignored files
  const ignoredFilesList = listFilesToProcess(ignoreExports);
  ignoredFilesList.forEach((_ref2) => {
    let filename = _ref2.filename;
    return ignoredFiles.add(filename);
  });

  // prepare list of source files, don't consider files from node_modules
  srcFileList.filter((_ref3) => {
    let filename = _ref3.filename;
    return !isNodeModule(filename);
  }).forEach((_ref4) => {
    let filename = _ref4.filename;

    srcFiles.add(filename);
  });
  return srcFiles;
};

/**
 * parse all source files and build up 2 maps containing the existing imports and exports
 */
const prepareImportsAndExports = (srcFiles, context) => {
  const exportAll = new Map();
  srcFiles.forEach(file => {
    const exports = new Map();
    const imports = new Map();
    const currentExports = _ExportMap2.default.get(file, context);
    if (currentExports) {
      const dependencies = currentExports.dependencies,
            reexports = currentExports.reexports,
            localImportList = currentExports.imports,
            namespace = currentExports.namespace;

      // dependencies === export * from

      const currentExportAll = new Set();
      dependencies.forEach(value => {
        currentExportAll.add(value().path);
      });
      exportAll.set(file, currentExportAll);

      reexports.forEach((value, key) => {
        if (key === DEFAULT) {
          exports.set(IMPORT_DEFAULT_SPECIFIER, { whereUsed: new Set() });
        } else {
          exports.set(key, { whereUsed: new Set() });
        }
        const reexport = value.getImport();
        if (!reexport) {
          return;
        }
        let localImport = imports.get(reexport.path);
        let currentValue;
        if (value.local === DEFAULT) {
          currentValue = IMPORT_DEFAULT_SPECIFIER;
        } else {
          currentValue = value.local;
        }
        if (typeof localImport !== 'undefined') {
          localImport = new Set([].concat(_toConsumableArray(localImport), [currentValue]));
        } else {
          localImport = new Set([currentValue]);
        }
        imports.set(reexport.path, localImport);
      });

      localImportList.forEach((value, key) => {
        if (isNodeModule(key)) {
          return;
        }
        imports.set(key, value.importedSpecifiers);
      });
      importList.set(file, imports);

      // build up export list only, if file is not ignored
      if (ignoredFiles.has(file)) {
        return;
      }
      namespace.forEach((value, key) => {
        if (key === DEFAULT) {
          exports.set(IMPORT_DEFAULT_SPECIFIER, { whereUsed: new Set() });
        } else {
          exports.set(key, { whereUsed: new Set() });
        }
      });
    }
    exports.set(EXPORT_ALL_DECLARATION, { whereUsed: new Set() });
    exports.set(IMPORT_NAMESPACE_SPECIFIER, { whereUsed: new Set() });
    exportList.set(file, exports);
  });
  exportAll.forEach((value, key) => {
    value.forEach(val => {
      const currentExports = exportList.get(val);
      const currentExport = currentExports.get(EXPORT_ALL_DECLARATION);
      currentExport.whereUsed.add(key);
    });
  });
};

/**
 * traverse through all imports and add the respective path to the whereUsed-list
 * of the corresponding export
 */
const determineUsage = () => {
  importList.forEach((listValue, listKey) => {
    listValue.forEach((value, key) => {
      const exports = exportList.get(key);
      if (typeof exports !== 'undefined') {
        value.forEach(currentImport => {
          let specifier;
          if (currentImport === IMPORT_NAMESPACE_SPECIFIER) {
            specifier = IMPORT_NAMESPACE_SPECIFIER;
          } else if (currentImport === IMPORT_DEFAULT_SPECIFIER) {
            specifier = IMPORT_DEFAULT_SPECIFIER;
          } else {
            specifier = currentImport;
          }
          if (typeof specifier !== 'undefined') {
            const exportStatement = exports.get(specifier);
            if (typeof exportStatement !== 'undefined') {
              const whereUsed = exportStatement.whereUsed;

              whereUsed.add(listKey);
              exports.set(specifier, { whereUsed });
            }
          }
        });
      }
    });
  });
};

const getSrc = src => {
  if (src) {
    return src;
  }
  return [process.cwd()];
};

/**
 * prepare the lists of existing imports and exports - should only be executed once at
 * the start of a new eslint run
 */
let srcFiles;
const doPreparation = (src, ignoreExports, context) => {
  srcFiles = resolveFiles(getSrc(src), ignoreExports);
  prepareImportsAndExports(srcFiles, context);
  determineUsage();
  preparationDone = true;
};

const newNamespaceImportExists = specifiers => specifiers.some((_ref5) => {
  let type = _ref5.type;
  return type === IMPORT_NAMESPACE_SPECIFIER;
});

const newDefaultImportExists = specifiers => specifiers.some((_ref6) => {
  let type = _ref6.type;
  return type === IMPORT_DEFAULT_SPECIFIER;
});

const fileIsInPkg = file => {
  var _readPkgUp$sync = _readPkgUp2.default.sync({ cwd: file, normalize: false });

  const path = _readPkgUp$sync.path,
        pkg = _readPkgUp$sync.pkg;

  const basePath = (0, _path.dirname)(path);

  const checkPkgFieldString = pkgField => {
    if ((0, _path.join)(basePath, pkgField) === file) {
      return true;
    }
  };

  const checkPkgFieldObject = pkgField => {
    const pkgFieldFiles = (0, _object2.default)(pkgField).map(value => (0, _path.join)(basePath, value));
    if ((0, _arrayIncludes2.default)(pkgFieldFiles, file)) {
      return true;
    }
  };

  const checkPkgField = pkgField => {
    if (typeof pkgField === 'string') {
      return checkPkgFieldString(pkgField);
    }

    if (typeof pkgField === 'object') {
      return checkPkgFieldObject(pkgField);
    }
  };

  if (pkg.private === true) {
    return false;
  }

  if (pkg.bin) {
    if (checkPkgField(pkg.bin)) {
      return true;
    }
  }

  if (pkg.browser) {
    if (checkPkgField(pkg.browser)) {
      return true;
    }
  }

  if (pkg.main) {
    if (checkPkgFieldString(pkg.main)) {
      return true;
    }
  }

  return false;
};

module.exports = {
  meta: {
    docs: { url: (0, _docsUrl2.default)('no-unused-modules') },
    schema: [{
      properties: {
        src: {
          description: 'files/paths to be analyzed (only for unused exports)',
          type: 'array',
          minItems: 1,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        ignoreExports: {
          description: 'files/paths for which unused exports will not be reported (e.g module entry points)',
          type: 'array',
          minItems: 1,
          items: {
            type: 'string',
            minLength: 1
          }
        },
        missingExports: {
          description: 'report modules without any exports',
          type: 'boolean'
        },
        unusedExports: {
          description: 'report exports without any usage',
          type: 'boolean'
        }
      },
      not: {
        properties: {
          unusedExports: { enum: [false] },
          missingExports: { enum: [false] }
        }
      },
      anyOf: [{
        not: {
          properties: {
            unusedExports: { enum: [true] }
          }
        },
        required: ['missingExports']
      }, {
        not: {
          properties: {
            missingExports: { enum: [true] }
          }
        },
        required: ['unusedExports']
      }, {
        properties: {
          unusedExports: { enum: [true] }
        },
        required: ['unusedExports']
      }, {
        properties: {
          missingExports: { enum: [true] }
        },
        required: ['missingExports']
      }]
    }]
  },

  create: context => {
    var _ref7 = context.options[0] || {};

    const src = _ref7.src;
    var _ref7$ignoreExports = _ref7.ignoreExports;
    const ignoreExports = _ref7$ignoreExports === undefined ? [] : _ref7$ignoreExports,
          missingExports = _ref7.missingExports,
          unusedExports = _ref7.unusedExports;


    if (unusedExports && !preparationDone) {
      doPreparation(src, ignoreExports, context);
    }

    const file = context.getFilename();

    const checkExportPresence = node => {
      if (!missingExports) {
        return;
      }

      if (ignoredFiles.has(file)) {
        return;
      }

      const exportCount = exportList.get(file);
      const exportAll = exportCount.get(EXPORT_ALL_DECLARATION);
      const namespaceImports = exportCount.get(IMPORT_NAMESPACE_SPECIFIER);

      exportCount.delete(EXPORT_ALL_DECLARATION);
      exportCount.delete(IMPORT_NAMESPACE_SPECIFIER);
      if (missingExports && exportCount.size < 1) {
        // node.body[0] === 'undefined' only happens, if everything is commented out in the file
        // being linted
        context.report(node.body[0] ? node.body[0] : node, 'No exports found');
      }
      exportCount.set(EXPORT_ALL_DECLARATION, exportAll);
      exportCount.set(IMPORT_NAMESPACE_SPECIFIER, namespaceImports);
    };

    const checkUsage = (node, exportedValue) => {
      if (!unusedExports) {
        return;
      }

      if (ignoredFiles.has(file)) {
        return;
      }

      if (fileIsInPkg(file)) {
        return;
      }

      if (filesOutsideSrc.has(file)) {
        return;
      }

      // make sure file to be linted is included in source files
      if (!srcFiles.has(file)) {
        srcFiles = resolveFiles(getSrc(src), ignoreExports);
        if (!srcFiles.has(file)) {
          filesOutsideSrc.add(file);
          return;
        }
      }

      exports = exportList.get(file);

      // special case: export * from
      const exportAll = exports.get(EXPORT_ALL_DECLARATION);
      if (typeof exportAll !== 'undefined' && exportedValue !== IMPORT_DEFAULT_SPECIFIER) {
        if (exportAll.whereUsed.size > 0) {
          return;
        }
      }

      // special case: namespace import
      const namespaceImports = exports.get(IMPORT_NAMESPACE_SPECIFIER);
      if (typeof namespaceImports !== 'undefined') {
        if (namespaceImports.whereUsed.size > 0) {
          return;
        }
      }

      const exportStatement = exports.get(exportedValue);

      const value = exportedValue === IMPORT_DEFAULT_SPECIFIER ? DEFAULT : exportedValue;

      if (typeof exportStatement !== 'undefined') {
        if (exportStatement.whereUsed.size < 1) {
          context.report(node, `exported declaration '${value}' not used within other modules`);
        }
      } else {
        context.report(node, `exported declaration '${value}' not used within other modules`);
      }
    };

    /**
     * only useful for tools like vscode-eslint
     *
     * update lists of existing exports during runtime
     */
    const updateExportUsage = node => {
      if (ignoredFiles.has(file)) {
        return;
      }

      let exports = exportList.get(file);

      // new module has been created during runtime
      // include it in further processing
      if (typeof exports === 'undefined') {
        exports = new Map();
      }

      const newExports = new Map();
      const newExportIdentifiers = new Set();

      node.body.forEach((_ref8) => {
        let type = _ref8.type,
            declaration = _ref8.declaration,
            specifiers = _ref8.specifiers;

        if (type === EXPORT_DEFAULT_DECLARATION) {
          newExportIdentifiers.add(IMPORT_DEFAULT_SPECIFIER);
        }
        if (type === EXPORT_NAMED_DECLARATION) {
          if (specifiers.length > 0) {
            specifiers.forEach(specifier => {
              if (specifier.exported) {
                newExportIdentifiers.add(specifier.exported.name);
              }
            });
          }
          if (declaration) {
            if (declaration.type === FUNCTION_DECLARATION || declaration.type === CLASS_DECLARATION) {
              newExportIdentifiers.add(declaration.id.name);
            }
            if (declaration.type === VARIABLE_DECLARATION) {
              declaration.declarations.forEach((_ref9) => {
                let id = _ref9.id;

                newExportIdentifiers.add(id.name);
              });
            }
          }
        }
      });

      // old exports exist within list of new exports identifiers: add to map of new exports
      exports.forEach((value, key) => {
        if (newExportIdentifiers.has(key)) {
          newExports.set(key, value);
        }
      });

      // new export identifiers added: add to map of new exports
      newExportIdentifiers.forEach(key => {
        if (!exports.has(key)) {
          newExports.set(key, { whereUsed: new Set() });
        }
      });

      // preserve information about namespace imports
      let exportAll = exports.get(EXPORT_ALL_DECLARATION);
      let namespaceImports = exports.get(IMPORT_NAMESPACE_SPECIFIER);

      if (typeof namespaceImports === 'undefined') {
        namespaceImports = { whereUsed: new Set() };
      }

      newExports.set(EXPORT_ALL_DECLARATION, exportAll);
      newExports.set(IMPORT_NAMESPACE_SPECIFIER, namespaceImports);
      exportList.set(file, newExports);
    };

    /**
     * only useful for tools like vscode-eslint
     *
     * update lists of existing imports during runtime
     */
    const updateImportUsage = node => {
      if (!unusedExports) {
        return;
      }

      let oldImportPaths = importList.get(file);
      if (typeof oldImportPaths === 'undefined') {
        oldImportPaths = new Map();
      }

      const oldNamespaceImports = new Set();
      const newNamespaceImports = new Set();

      const oldExportAll = new Set();
      const newExportAll = new Set();

      const oldDefaultImports = new Set();
      const newDefaultImports = new Set();

      const oldImports = new Map();
      const newImports = new Map();
      oldImportPaths.forEach((value, key) => {
        if (value.has(EXPORT_ALL_DECLARATION)) {
          oldExportAll.add(key);
        }
        if (value.has(IMPORT_NAMESPACE_SPECIFIER)) {
          oldNamespaceImports.add(key);
        }
        if (value.has(IMPORT_DEFAULT_SPECIFIER)) {
          oldDefaultImports.add(key);
        }
        value.forEach(val => {
          if (val !== IMPORT_NAMESPACE_SPECIFIER && val !== IMPORT_DEFAULT_SPECIFIER) {
            oldImports.set(val, key);
          }
        });
      });

      node.body.forEach(astNode => {
        let resolvedPath;

        // support for export { value } from 'module'
        if (astNode.type === EXPORT_NAMED_DECLARATION) {
          if (astNode.source) {
            resolvedPath = (0, _resolve2.default)(astNode.source.raw.replace(/('|")/g, ''), context);
            astNode.specifiers.forEach(specifier => {
              let name;
              if (specifier.exported.name === DEFAULT) {
                name = IMPORT_DEFAULT_SPECIFIER;
              } else {
                name = specifier.local.name;
              }
              newImports.set(name, resolvedPath);
            });
          }
        }

        if (astNode.type === EXPORT_ALL_DECLARATION) {
          resolvedPath = (0, _resolve2.default)(astNode.source.raw.replace(/('|")/g, ''), context);
          newExportAll.add(resolvedPath);
        }

        if (astNode.type === IMPORT_DECLARATION) {
          resolvedPath = (0, _resolve2.default)(astNode.source.raw.replace(/('|")/g, ''), context);
          if (!resolvedPath) {
            return;
          }

          if (isNodeModule(resolvedPath)) {
            return;
          }

          if (newNamespaceImportExists(astNode.specifiers)) {
            newNamespaceImports.add(resolvedPath);
          }

          if (newDefaultImportExists(astNode.specifiers)) {
            newDefaultImports.add(resolvedPath);
          }

          astNode.specifiers.forEach(specifier => {
            if (specifier.type === IMPORT_DEFAULT_SPECIFIER || specifier.type === IMPORT_NAMESPACE_SPECIFIER) {
              return;
            }
            newImports.set(specifier.imported.name, resolvedPath);
          });
        }
      });

      newExportAll.forEach(value => {
        if (!oldExportAll.has(value)) {
          let imports = oldImportPaths.get(value);
          if (typeof imports === 'undefined') {
            imports = new Set();
          }
          imports.add(EXPORT_ALL_DECLARATION);
          oldImportPaths.set(value, imports);

          let exports = exportList.get(value);
          let currentExport;
          if (typeof exports !== 'undefined') {
            currentExport = exports.get(EXPORT_ALL_DECLARATION);
          } else {
            exports = new Map();
            exportList.set(value, exports);
          }

          if (typeof currentExport !== 'undefined') {
            currentExport.whereUsed.add(file);
          } else {
            const whereUsed = new Set();
            whereUsed.add(file);
            exports.set(EXPORT_ALL_DECLARATION, { whereUsed });
          }
        }
      });

      oldExportAll.forEach(value => {
        if (!newExportAll.has(value)) {
          const imports = oldImportPaths.get(value);
          imports.delete(EXPORT_ALL_DECLARATION);

          const exports = exportList.get(value);
          if (typeof exports !== 'undefined') {
            const currentExport = exports.get(EXPORT_ALL_DECLARATION);
            if (typeof currentExport !== 'undefined') {
              currentExport.whereUsed.delete(file);
            }
          }
        }
      });

      newDefaultImports.forEach(value => {
        if (!oldDefaultImports.has(value)) {
          let imports = oldImportPaths.get(value);
          if (typeof imports === 'undefined') {
            imports = new Set();
          }
          imports.add(IMPORT_DEFAULT_SPECIFIER);
          oldImportPaths.set(value, imports);

          let exports = exportList.get(value);
          let currentExport;
          if (typeof exports !== 'undefined') {
            currentExport = exports.get(IMPORT_DEFAULT_SPECIFIER);
          } else {
            exports = new Map();
            exportList.set(value, exports);
          }

          if (typeof currentExport !== 'undefined') {
            currentExport.whereUsed.add(file);
          } else {
            const whereUsed = new Set();
            whereUsed.add(file);
            exports.set(IMPORT_DEFAULT_SPECIFIER, { whereUsed });
          }
        }
      });

      oldDefaultImports.forEach(value => {
        if (!newDefaultImports.has(value)) {
          const imports = oldImportPaths.get(value);
          imports.delete(IMPORT_DEFAULT_SPECIFIER);

          const exports = exportList.get(value);
          if (typeof exports !== 'undefined') {
            const currentExport = exports.get(IMPORT_DEFAULT_SPECIFIER);
            if (typeof currentExport !== 'undefined') {
              currentExport.whereUsed.delete(file);
            }
          }
        }
      });

      newNamespaceImports.forEach(value => {
        if (!oldNamespaceImports.has(value)) {
          let imports = oldImportPaths.get(value);
          if (typeof imports === 'undefined') {
            imports = new Set();
          }
          imports.add(IMPORT_NAMESPACE_SPECIFIER);
          oldImportPaths.set(value, imports);

          let exports = exportList.get(value);
          let currentExport;
          if (typeof exports !== 'undefined') {
            currentExport = exports.get(IMPORT_NAMESPACE_SPECIFIER);
          } else {
            exports = new Map();
            exportList.set(value, exports);
          }

          if (typeof currentExport !== 'undefined') {
            currentExport.whereUsed.add(file);
          } else {
            const whereUsed = new Set();
            whereUsed.add(file);
            exports.set(IMPORT_NAMESPACE_SPECIFIER, { whereUsed });
          }
        }
      });

      oldNamespaceImports.forEach(value => {
        if (!newNamespaceImports.has(value)) {
          const imports = oldImportPaths.get(value);
          imports.delete(IMPORT_NAMESPACE_SPECIFIER);

          const exports = exportList.get(value);
          if (typeof exports !== 'undefined') {
            const currentExport = exports.get(IMPORT_NAMESPACE_SPECIFIER);
            if (typeof currentExport !== 'undefined') {
              currentExport.whereUsed.delete(file);
            }
          }
        }
      });

      newImports.forEach((value, key) => {
        if (!oldImports.has(key)) {
          let imports = oldImportPaths.get(value);
          if (typeof imports === 'undefined') {
            imports = new Set();
          }
          imports.add(key);
          oldImportPaths.set(value, imports);

          let exports = exportList.get(value);
          let currentExport;
          if (typeof exports !== 'undefined') {
            currentExport = exports.get(key);
          } else {
            exports = new Map();
            exportList.set(value, exports);
          }

          if (typeof currentExport !== 'undefined') {
            currentExport.whereUsed.add(file);
          } else {
            const whereUsed = new Set();
            whereUsed.add(file);
            exports.set(key, { whereUsed });
          }
        }
      });

      oldImports.forEach((value, key) => {
        if (!newImports.has(key)) {
          const imports = oldImportPaths.get(value);
          imports.delete(key);

          const exports = exportList.get(value);
          if (typeof exports !== 'undefined') {
            const currentExport = exports.get(key);
            if (typeof currentExport !== 'undefined') {
              currentExport.whereUsed.delete(file);
            }
          }
        }
      });
    };

    return {
      'Program:exit': node => {
        updateExportUsage(node);
        updateImportUsage(node);
        checkExportPresence(node);
      },
      'ExportDefaultDeclaration': node => {
        checkUsage(node, IMPORT_DEFAULT_SPECIFIER);
      },
      'ExportNamedDeclaration': node => {
        node.specifiers.forEach(specifier => {
          checkUsage(node, specifier.exported.name);
        });
        if (node.declaration) {
          if (node.declaration.type === FUNCTION_DECLARATION || node.declaration.type === CLASS_DECLARATION) {
            checkUsage(node, node.declaration.id.name);
          }
          if (node.declaration.type === VARIABLE_DECLARATION) {
            node.declaration.declarations.forEach(declaration => {
              checkUsage(node, declaration.id.name);
            });
          }
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uby11bnVzZWQtbW9kdWxlcy5qcyJdLCJuYW1lcyI6WyJsaXN0RmlsZXNUb1Byb2Nlc3MiLCJGaWxlRW51bWVyYXRvciIsInJlcXVpcmUiLCJzcmMiLCJlIiwiQXJyYXkiLCJmcm9tIiwiaXRlcmF0ZUZpbGVzIiwiZmlsZVBhdGgiLCJpZ25vcmVkIiwiZmlsZW5hbWUiLCJlMSIsImUyIiwiRVhQT1JUX0RFRkFVTFRfREVDTEFSQVRJT04iLCJFWFBPUlRfTkFNRURfREVDTEFSQVRJT04iLCJFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OIiwiSU1QT1JUX0RFQ0xBUkFUSU9OIiwiSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIiLCJJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIiLCJWQVJJQUJMRV9ERUNMQVJBVElPTiIsIkZVTkNUSU9OX0RFQ0xBUkFUSU9OIiwiQ0xBU1NfREVDTEFSQVRJT04iLCJERUZBVUxUIiwicHJlcGFyYXRpb25Eb25lIiwiaW1wb3J0TGlzdCIsIk1hcCIsImV4cG9ydExpc3QiLCJpZ25vcmVkRmlsZXMiLCJTZXQiLCJmaWxlc091dHNpZGVTcmMiLCJpc05vZGVNb2R1bGUiLCJwYXRoIiwidGVzdCIsInJlc29sdmVGaWxlcyIsImlnbm9yZUV4cG9ydHMiLCJzcmNGaWxlcyIsInNyY0ZpbGVMaXN0IiwiaWdub3JlZEZpbGVzTGlzdCIsImZvckVhY2giLCJhZGQiLCJmaWx0ZXIiLCJwcmVwYXJlSW1wb3J0c0FuZEV4cG9ydHMiLCJjb250ZXh0IiwiZXhwb3J0QWxsIiwiZmlsZSIsImV4cG9ydHMiLCJpbXBvcnRzIiwiY3VycmVudEV4cG9ydHMiLCJFeHBvcnRzIiwiZ2V0IiwiZGVwZW5kZW5jaWVzIiwicmVleHBvcnRzIiwibG9jYWxJbXBvcnRMaXN0IiwibmFtZXNwYWNlIiwiY3VycmVudEV4cG9ydEFsbCIsInZhbHVlIiwic2V0Iiwia2V5Iiwid2hlcmVVc2VkIiwicmVleHBvcnQiLCJnZXRJbXBvcnQiLCJsb2NhbEltcG9ydCIsImN1cnJlbnRWYWx1ZSIsImxvY2FsIiwiaW1wb3J0ZWRTcGVjaWZpZXJzIiwiaGFzIiwidmFsIiwiY3VycmVudEV4cG9ydCIsImRldGVybWluZVVzYWdlIiwibGlzdFZhbHVlIiwibGlzdEtleSIsImN1cnJlbnRJbXBvcnQiLCJzcGVjaWZpZXIiLCJleHBvcnRTdGF0ZW1lbnQiLCJnZXRTcmMiLCJwcm9jZXNzIiwiY3dkIiwiZG9QcmVwYXJhdGlvbiIsIm5ld05hbWVzcGFjZUltcG9ydEV4aXN0cyIsInNwZWNpZmllcnMiLCJzb21lIiwidHlwZSIsIm5ld0RlZmF1bHRJbXBvcnRFeGlzdHMiLCJmaWxlSXNJblBrZyIsInJlYWRQa2dVcCIsInN5bmMiLCJub3JtYWxpemUiLCJwa2ciLCJiYXNlUGF0aCIsImNoZWNrUGtnRmllbGRTdHJpbmciLCJwa2dGaWVsZCIsImNoZWNrUGtnRmllbGRPYmplY3QiLCJwa2dGaWVsZEZpbGVzIiwibWFwIiwiY2hlY2tQa2dGaWVsZCIsInByaXZhdGUiLCJiaW4iLCJicm93c2VyIiwibWFpbiIsIm1vZHVsZSIsIm1ldGEiLCJkb2NzIiwidXJsIiwic2NoZW1hIiwicHJvcGVydGllcyIsImRlc2NyaXB0aW9uIiwibWluSXRlbXMiLCJpdGVtcyIsIm1pbkxlbmd0aCIsIm1pc3NpbmdFeHBvcnRzIiwidW51c2VkRXhwb3J0cyIsIm5vdCIsImVudW0iLCJhbnlPZiIsInJlcXVpcmVkIiwiY3JlYXRlIiwib3B0aW9ucyIsImdldEZpbGVuYW1lIiwiY2hlY2tFeHBvcnRQcmVzZW5jZSIsIm5vZGUiLCJleHBvcnRDb3VudCIsIm5hbWVzcGFjZUltcG9ydHMiLCJkZWxldGUiLCJzaXplIiwicmVwb3J0IiwiYm9keSIsImNoZWNrVXNhZ2UiLCJleHBvcnRlZFZhbHVlIiwidXBkYXRlRXhwb3J0VXNhZ2UiLCJuZXdFeHBvcnRzIiwibmV3RXhwb3J0SWRlbnRpZmllcnMiLCJkZWNsYXJhdGlvbiIsImxlbmd0aCIsImV4cG9ydGVkIiwibmFtZSIsImlkIiwiZGVjbGFyYXRpb25zIiwidXBkYXRlSW1wb3J0VXNhZ2UiLCJvbGRJbXBvcnRQYXRocyIsIm9sZE5hbWVzcGFjZUltcG9ydHMiLCJuZXdOYW1lc3BhY2VJbXBvcnRzIiwib2xkRXhwb3J0QWxsIiwibmV3RXhwb3J0QWxsIiwib2xkRGVmYXVsdEltcG9ydHMiLCJuZXdEZWZhdWx0SW1wb3J0cyIsIm9sZEltcG9ydHMiLCJuZXdJbXBvcnRzIiwiYXN0Tm9kZSIsInJlc29sdmVkUGF0aCIsInNvdXJjZSIsInJhdyIsInJlcGxhY2UiLCJpbXBvcnRlZCJdLCJtYXBwaW5ncyI6Ijs7QUFNQTs7OztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztnTUFaQTs7Ozs7O0FBY0E7QUFDQTtBQUNBLElBQUlBLGtCQUFKO0FBQ0EsSUFBSTtBQUNGLE1BQUlDLGlCQUFpQkMsUUFBUSx1Q0FBUixFQUFpREQsY0FBdEU7QUFDQUQsdUJBQXFCLFVBQVVHLEdBQVYsRUFBZTtBQUNsQyxRQUFJQyxJQUFJLElBQUlILGNBQUosRUFBUjtBQUNBLFdBQU9JLE1BQU1DLElBQU4sQ0FBV0YsRUFBRUcsWUFBRixDQUFlSixHQUFmLENBQVgsRUFBZ0M7QUFBQSxVQUFHSyxRQUFILFFBQUdBLFFBQUg7QUFBQSxVQUFhQyxPQUFiLFFBQWFBLE9BQWI7QUFBQSxhQUE0QjtBQUNqRUEsZUFEaUU7QUFFakVDLGtCQUFVRjtBQUZ1RCxPQUE1QjtBQUFBLEtBQWhDLENBQVA7QUFJRCxHQU5EO0FBT0QsQ0FURCxDQVNFLE9BQU9HLEVBQVAsRUFBVztBQUNYLE1BQUk7QUFDRlgseUJBQXFCRSxRQUFRLDRCQUFSLEVBQXNDRixrQkFBM0Q7QUFDRCxHQUZELENBRUUsT0FBT1ksRUFBUCxFQUFXO0FBQ1haLHlCQUFxQkUsUUFBUSwyQkFBUixFQUFxQ0Ysa0JBQTFEO0FBQ0Q7QUFDRjs7QUFFRCxNQUFNYSw2QkFBNkIsMEJBQW5DO0FBQ0EsTUFBTUMsMkJBQTJCLHdCQUFqQztBQUNBLE1BQU1DLHlCQUF5QixzQkFBL0I7QUFD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RUFBaUJyRyx3QkFBakI7QUFDRCxPQVJJO0FBU0wsZ0NBQTBCcUcsUUFBUTtBQUNoQ0EsYUFBS3hDLFVBQUwsQ0FBZ0J6QyxPQUFoQixDQUF3QmtDLGFBQWE7QUFDakNzRCxxQkFBV1AsSUFBWCxFQUFpQi9DLFVBQVU2RCxRQUFWLENBQW1CQyxJQUFwQztBQUNILFNBRkQ7QUFHQSxZQUFJZixLQUFLWSxXQUFULEVBQXNCO0FBQ3BCLGNBQ0VaLEtBQUtZLFdBQUwsQ0FBaUJsRCxJQUFqQixLQUEwQjdELG9CQUExQixJQUNBbUcsS0FBS1ksV0FBTCxDQUFpQmxELElBQWpCLEtBQTBCNUQsaUJBRjVCLEVBR0U7QUFDQXlHLHVCQUFXUCxJQUFYLEVBQWlCQSxLQUFLWSxXQUFMLENBQWlCSSxFQUFqQixDQUFvQkQsSUFBckM7QUFDRDtBQUNELGNBQUlmLEtBQUtZLFdBQUwsQ0FBaUJsRCxJQUFqQixLQUEwQjlELG9CQUE5QixFQUFvRDtBQUNsRG9HLGlCQUFLWSxXQUFMLENBQWlCSyxZQUFqQixDQUE4QmxHLE9BQTlCLENBQXNDNkYsZUFBZTtBQUNuREwseUJBQVdQLElBQVgsRUFBaUJZLFlBQVlJLEVBQVosQ0FBZUQsSUFBaEM7QUFDRCxhQUZEO0FBR0Q7QUFDRjtBQUNGO0FBMUJJLEtBQVA7QUE0QkQ7QUE3aEJjLENBQWpCIiwiZmlsZSI6Im5vLXVudXNlZC1tb2R1bGVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAZmlsZU92ZXJ2aWV3IEVuc3VyZXMgdGhhdCBtb2R1bGVzIGNvbnRhaW4gZXhwb3J0cyBhbmQvb3IgYWxsXG4gKiBtb2R1bGVzIGFyZSBjb25zdW1lZCB3aXRoaW4gb3RoZXIgbW9kdWxlcy5cbiAqIEBhdXRob3IgUmVuw6kgRmVybWFublxuICovXG5cbmltcG9ydCBFeHBvcnRzIGZyb20gJy4uL0V4cG9ydE1hcCdcbmltcG9ydCByZXNvbHZlIGZyb20gJ2VzbGludC1tb2R1bGUtdXRpbHMvcmVzb2x2ZSdcbmltcG9ydCBkb2NzVXJsIGZyb20gJy4uL2RvY3NVcmwnXG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luIH0gZnJvbSAncGF0aCdcbmltcG9ydCByZWFkUGtnVXAgZnJvbSAncmVhZC1wa2ctdXAnXG5pbXBvcnQgdmFsdWVzIGZyb20gJ29iamVjdC52YWx1ZXMnXG5pbXBvcnQgaW5jbHVkZXMgZnJvbSAnYXJyYXktaW5jbHVkZXMnXG5cbi8vIGVzbGludC9saWIvdXRpbC9nbG9iLXV0aWwgaGFzIGJlZW4gbW92ZWQgdG8gZXNsaW50L2xpYi91dGlsL2dsb2ItdXRpbHMgd2l0aCB2ZXJzaW9uIDUuM1xuLy8gYW5kIGhhcyBiZWVuIG1vdmVkIHRvIGVzbGludC9saWIvY2xpLWVuZ2luZS9maWxlLWVudW1lcmF0b3IgaW4gdmVyc2lvbiA2XG5sZXQgbGlzdEZpbGVzVG9Qcm9jZXNzXG50cnkge1xuICB2YXIgRmlsZUVudW1lcmF0b3IgPSByZXF1aXJlKCdlc2xpbnQvbGliL2NsaS1lbmdpbmUvZmlsZS1lbnVtZXJhdG9yJykuRmlsZUVudW1lcmF0b3JcbiAgbGlzdEZpbGVzVG9Qcm9jZXNzID0gZnVuY3Rpb24gKHNyYykge1xuICAgIHZhciBlID0gbmV3IEZpbGVFbnVtZXJhdG9yKClcbiAgICByZXR1cm4gQXJyYXkuZnJvbShlLml0ZXJhdGVGaWxlcyhzcmMpLCAoeyBmaWxlUGF0aCwgaWdub3JlZCB9KSA9PiAoe1xuICAgICAgaWdub3JlZCxcbiAgICAgIGZpbGVuYW1lOiBmaWxlUGF0aCxcbiAgICB9KSlcbiAgfVxufSBjYXRjaCAoZTEpIHtcbiAgdHJ5IHtcbiAgICBsaXN0RmlsZXNUb1Byb2Nlc3MgPSByZXF1aXJlKCdlc2xpbnQvbGliL3V0aWwvZ2xvYi11dGlscycpLmxpc3RGaWxlc1RvUHJvY2Vzc1xuICB9IGNhdGNoIChlMikge1xuICAgIGxpc3RGaWxlc1RvUHJvY2VzcyA9IHJlcXVpcmUoJ2VzbGludC9saWIvdXRpbC9nbG9iLXV0aWwnKS5saXN0RmlsZXNUb1Byb2Nlc3NcbiAgfVxufVxuXG5jb25zdCBFWFBPUlRfREVGQVVMVF9ERUNMQVJBVElPTiA9ICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nXG5jb25zdCBFWFBPUlRfTkFNRURfREVDTEFSQVRJT04gPSAnRXhwb3J0TmFtZWREZWNsYXJhdGlvbidcbmNvbnN0IEVYUE9SVF9BTExfREVDTEFSQVRJT04gPSAnRXhwb3J0QWxsRGVjbGFyYXRpb24nXG5jb25zdCBJTVBPUlRfREVDTEFSQVRJT04gPSAnSW1wb3J0RGVjbGFyYXRpb24nXG5jb25zdCBJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUiA9ICdJbXBvcnROYW1lc3BhY2VTcGVjaWZpZXInXG5jb25zdCBJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIgPSAnSW1wb3J0RGVmYXVsdFNwZWNpZmllcidcbmNvbnN0IFZBUklBQkxFX0RFQ0xBUkFUSU9OID0gJ1ZhcmlhYmxlRGVjbGFyYXRpb24nXG5jb25zdCBGVU5DVElPTl9ERUNMQVJBVElPTiA9ICdGdW5jdGlvbkRlY2xhcmF0aW9uJ1xuY29uc3QgQ0xBU1NfREVDTEFSQVRJT04gPSAnQ2xhc3NEZWNsYXJhdGlvbidcbmNvbnN0IERFRkFVTFQgPSAnZGVmYXVsdCdcblxubGV0IHByZXBhcmF0aW9uRG9uZSA9IGZhbHNlXG5jb25zdCBpbXBvcnRMaXN0ID0gbmV3IE1hcCgpXG5jb25zdCBleHBvcnRMaXN0ID0gbmV3IE1hcCgpXG5jb25zdCBpZ25vcmVkRmlsZXMgPSBuZXcgU2V0KClcbmNvbnN0IGZpbGVzT3V0c2lkZVNyYyA9IG5ldyBTZXQoKVxuXG5jb25zdCBpc05vZGVNb2R1bGUgPSBwYXRoID0+IHtcbiAgcmV0dXJuIC9cXC8obm9kZV9tb2R1bGVzKVxcLy8udGVzdChwYXRoKVxufVxuXG4vKipcbiAqIHJlYWQgYWxsIGZpbGVzIG1hdGNoaW5nIHRoZSBwYXR0ZXJucyBpbiBzcmMgYW5kIGlnbm9yZUV4cG9ydHNcbiAqXG4gKiByZXR1cm4gYWxsIGZpbGVzIG1hdGNoaW5nIHNyYyBwYXR0ZXJuLCB3aGljaCBhcmUgbm90IG1hdGNoaW5nIHRoZSBpZ25vcmVFeHBvcnRzIHBhdHRlcm5cbiAqL1xuY29uc3QgcmVzb2x2ZUZpbGVzID0gKHNyYywgaWdub3JlRXhwb3J0cykgPT4ge1xuICBjb25zdCBzcmNGaWxlcyA9IG5ldyBTZXQoKVxuICBjb25zdCBzcmNGaWxlTGlzdCA9IGxpc3RGaWxlc1RvUHJvY2VzcyhzcmMpXG5cbiAgLy8gcHJlcGFyZSBsaXN0IG9mIGlnbm9yZWQgZmlsZXNcbiAgY29uc3QgaWdub3JlZEZpbGVzTGlzdCA9ICBsaXN0RmlsZXNUb1Byb2Nlc3MoaWdub3JlRXhwb3J0cylcbiAgaWdub3JlZEZpbGVzTGlzdC5mb3JFYWNoKCh7IGZpbGVuYW1lIH0pID0+IGlnbm9yZWRGaWxlcy5hZGQoZmlsZW5hbWUpKVxuXG4gIC8vIHByZXBhcmUgbGlzdCBvZiBzb3VyY2UgZmlsZXMsIGRvbid0IGNvbnNpZGVyIGZpbGVzIGZyb20gbm9kZV9tb2R1bGVzXG4gIHNyY0ZpbGVMaXN0LmZpbHRlcigoeyBmaWxlbmFtZSB9KSA9PiAhaXNOb2RlTW9kdWxlKGZpbGVuYW1lKSkuZm9yRWFjaCgoeyBmaWxlbmFtZSB9KSA9PiB7XG4gICAgc3JjRmlsZXMuYWRkKGZpbGVuYW1lKVxuICB9KVxuICByZXR1cm4gc3JjRmlsZXNcbn1cblxuLyoqXG4gKiBwYXJzZSBhbGwgc291cmNlIGZpbGVzIGFuZCBidWlsZCB1cCAyIG1hcHMgY29udGFpbmluZyB0aGUgZXhpc3RpbmcgaW1wb3J0cyBhbmQgZXhwb3J0c1xuICovXG5jb25zdCBwcmVwYXJlSW1wb3J0c0FuZEV4cG9ydHMgPSAoc3JjRmlsZXMsIGNvbnRleHQpID0+IHtcbiAgY29uc3QgZXhwb3J0QWxsID0gbmV3IE1hcCgpXG4gIHNyY0ZpbGVzLmZvckVhY2goZmlsZSA9PiB7XG4gICAgY29uc3QgZXhwb3J0cyA9IG5ldyBNYXAoKVxuICAgIGNvbnN0IGltcG9ydHMgPSBuZXcgTWFwKClcbiAgICBjb25zdCBjdXJyZW50RXhwb3J0cyA9IEV4cG9ydHMuZ2V0KGZpbGUsIGNvbnRleHQpXG4gICAgaWYgKGN1cnJlbnRFeHBvcnRzKSB7XG4gICAgICBjb25zdCB7IGRlcGVuZGVuY2llcywgcmVleHBvcnRzLCBpbXBvcnRzOiBsb2NhbEltcG9ydExpc3QsIG5hbWVzcGFjZSAgfSA9IGN1cnJlbnRFeHBvcnRzXG5cbiAgICAgIC8vIGRlcGVuZGVuY2llcyA9PT0gZXhwb3J0ICogZnJvbVxuICAgICAgY29uc3QgY3VycmVudEV4cG9ydEFsbCA9IG5ldyBTZXQoKVxuICAgICAgZGVwZW5kZW5jaWVzLmZvckVhY2godmFsdWUgPT4ge1xuICAgICAgICBjdXJyZW50RXhwb3J0QWxsLmFkZCh2YWx1ZSgpLnBhdGgpXG4gICAgICB9KVxuICAgICAgZXhwb3J0QWxsLnNldChmaWxlLCBjdXJyZW50RXhwb3J0QWxsKVxuXG4gICAgICByZWV4cG9ydHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAoa2V5ID09PSBERUZBVUxUKSB7XG4gICAgICAgICAgZXhwb3J0cy5zZXQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSLCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhwb3J0cy5zZXQoa2V5LCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pXG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVleHBvcnQgPSAgdmFsdWUuZ2V0SW1wb3J0KClcbiAgICAgICAgaWYgKCFyZWV4cG9ydCkge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGxldCBsb2NhbEltcG9ydCA9IGltcG9ydHMuZ2V0KHJlZXhwb3J0LnBhdGgpXG4gICAgICAgIGxldCBjdXJyZW50VmFsdWVcbiAgICAgICAgaWYgKHZhbHVlLmxvY2FsID09PSBERUZBVUxUKSB7XG4gICAgICAgICAgY3VycmVudFZhbHVlID0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VycmVudFZhbHVlID0gdmFsdWUubG9jYWxcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGxvY2FsSW1wb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGxvY2FsSW1wb3J0ID0gbmV3IFNldChbLi4ubG9jYWxJbXBvcnQsIGN1cnJlbnRWYWx1ZV0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbG9jYWxJbXBvcnQgPSBuZXcgU2V0KFtjdXJyZW50VmFsdWVdKVxuICAgICAgICB9XG4gICAgICAgIGltcG9ydHMuc2V0KHJlZXhwb3J0LnBhdGgsIGxvY2FsSW1wb3J0KVxuICAgICAgfSlcblxuICAgICAgbG9jYWxJbXBvcnRMaXN0LmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgaWYgKGlzTm9kZU1vZHVsZShrZXkpKSB7XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgICAgaW1wb3J0cy5zZXQoa2V5LCB2YWx1ZS5pbXBvcnRlZFNwZWNpZmllcnMpXG4gICAgICB9KVxuICAgICAgaW1wb3J0TGlzdC5zZXQoZmlsZSwgaW1wb3J0cylcblxuICAgICAgLy8gYnVpbGQgdXAgZXhwb3J0IGxpc3Qgb25seSwgaWYgZmlsZSBpcyBub3QgaWdub3JlZFxuICAgICAgaWYgKGlnbm9yZWRGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBuYW1lc3BhY2UuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAoa2V5ID09PSBERUZBVUxUKSB7XG4gICAgICAgICAgZXhwb3J0cy5zZXQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSLCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZXhwb3J0cy5zZXQoa2V5LCB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH0pXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICAgIGV4cG9ydHMuc2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04sIHsgd2hlcmVVc2VkOiBuZXcgU2V0KCkgfSlcbiAgICBleHBvcnRzLnNldChJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUiwgeyB3aGVyZVVzZWQ6IG5ldyBTZXQoKSB9KVxuICAgIGV4cG9ydExpc3Quc2V0KGZpbGUsIGV4cG9ydHMpXG4gIH0pXG4gIGV4cG9ydEFsbC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgdmFsdWUuZm9yRWFjaCh2YWwgPT4ge1xuICAgICAgY29uc3QgY3VycmVudEV4cG9ydHMgPSBleHBvcnRMaXN0LmdldCh2YWwpXG4gICAgICBjb25zdCBjdXJyZW50RXhwb3J0ID0gY3VycmVudEV4cG9ydHMuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG4gICAgICBjdXJyZW50RXhwb3J0LndoZXJlVXNlZC5hZGQoa2V5KVxuICAgIH0pXG4gIH0pXG59XG5cbi8qKlxuICogdHJhdmVyc2UgdGhyb3VnaCBhbGwgaW1wb3J0cyBhbmQgYWRkIHRoZSByZXNwZWN0aXZlIHBhdGggdG8gdGhlIHdoZXJlVXNlZC1saXN0XG4gKiBvZiB0aGUgY29ycmVzcG9uZGluZyBleHBvcnRcbiAqL1xuY29uc3QgZGV0ZXJtaW5lVXNhZ2UgPSAoKSA9PiB7XG4gIGltcG9ydExpc3QuZm9yRWFjaCgobGlzdFZhbHVlLCBsaXN0S2V5KSA9PiB7XG4gICAgbGlzdFZhbHVlLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgIGNvbnN0IGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldChrZXkpXG4gICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhbHVlLmZvckVhY2goY3VycmVudEltcG9ydCA9PiB7XG4gICAgICAgICAgbGV0IHNwZWNpZmllclxuICAgICAgICAgIGlmIChjdXJyZW50SW1wb3J0ID09PSBJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUikge1xuICAgICAgICAgICAgc3BlY2lmaWVyID0gSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVJcbiAgICAgICAgICB9IGVsc2UgaWYgKGN1cnJlbnRJbXBvcnQgPT09IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUikge1xuICAgICAgICAgICAgc3BlY2lmaWVyID0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNwZWNpZmllciA9IGN1cnJlbnRJbXBvcnRcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHR5cGVvZiBzcGVjaWZpZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBleHBvcnRTdGF0ZW1lbnQgPSBleHBvcnRzLmdldChzcGVjaWZpZXIpXG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydFN0YXRlbWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgY29uc3QgeyB3aGVyZVVzZWQgfSA9IGV4cG9ydFN0YXRlbWVudFxuICAgICAgICAgICAgICB3aGVyZVVzZWQuYWRkKGxpc3RLZXkpXG4gICAgICAgICAgICAgIGV4cG9ydHMuc2V0KHNwZWNpZmllciwgeyB3aGVyZVVzZWQgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgfSlcbiAgfSlcbn1cblxuY29uc3QgZ2V0U3JjID0gc3JjID0+IHtcbiAgaWYgKHNyYykge1xuICAgIHJldHVybiBzcmNcbiAgfVxuICByZXR1cm4gW3Byb2Nlc3MuY3dkKCldXG59XG5cbi8qKlxuICogcHJlcGFyZSB0aGUgbGlzdHMgb2YgZXhpc3RpbmcgaW1wb3J0cyBhbmQgZXhwb3J0cyAtIHNob3VsZCBvbmx5IGJlIGV4ZWN1dGVkIG9uY2UgYXRcbiAqIHRoZSBzdGFydCBvZiBhIG5ldyBlc2xpbnQgcnVuXG4gKi9cbmxldCBzcmNGaWxlc1xuY29uc3QgZG9QcmVwYXJhdGlvbiA9IChzcmMsIGlnbm9yZUV4cG9ydHMsIGNvbnRleHQpID0+IHtcbiAgc3JjRmlsZXMgPSByZXNvbHZlRmlsZXMoZ2V0U3JjKHNyYyksIGlnbm9yZUV4cG9ydHMpXG4gIHByZXBhcmVJbXBvcnRzQW5kRXhwb3J0cyhzcmNGaWxlcywgY29udGV4dClcbiAgZGV0ZXJtaW5lVXNhZ2UoKVxuICBwcmVwYXJhdGlvbkRvbmUgPSB0cnVlXG59XG5cbmNvbnN0IG5ld05hbWVzcGFjZUltcG9ydEV4aXN0cyA9IHNwZWNpZmllcnMgPT5cbiAgc3BlY2lmaWVycy5zb21lKCh7IHR5cGUgfSkgPT4gdHlwZSA9PT0gSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpXG5cbmNvbnN0IG5ld0RlZmF1bHRJbXBvcnRFeGlzdHMgPSBzcGVjaWZpZXJzID0+XG4gIHNwZWNpZmllcnMuc29tZSgoeyB0eXBlIH0pID0+IHR5cGUgPT09IElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUilcblxuY29uc3QgZmlsZUlzSW5Qa2cgPSBmaWxlID0+IHtcbiAgY29uc3QgeyBwYXRoLCBwa2cgfSA9IHJlYWRQa2dVcC5zeW5jKHtjd2Q6IGZpbGUsIG5vcm1hbGl6ZTogZmFsc2V9KVxuICBjb25zdCBiYXNlUGF0aCA9IGRpcm5hbWUocGF0aClcblxuICBjb25zdCBjaGVja1BrZ0ZpZWxkU3RyaW5nID0gcGtnRmllbGQgPT4ge1xuICAgIGlmIChqb2luKGJhc2VQYXRoLCBwa2dGaWVsZCkgPT09IGZpbGUpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgfVxuXG4gIGNvbnN0IGNoZWNrUGtnRmllbGRPYmplY3QgPSBwa2dGaWVsZCA9PiB7XG4gICAgICBjb25zdCBwa2dGaWVsZEZpbGVzID0gdmFsdWVzKHBrZ0ZpZWxkKS5tYXAodmFsdWUgPT4gam9pbihiYXNlUGF0aCwgdmFsdWUpKVxuICAgICAgaWYgKGluY2x1ZGVzKHBrZ0ZpZWxkRmlsZXMsIGZpbGUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gIH1cblxuICBjb25zdCBjaGVja1BrZ0ZpZWxkID0gcGtnRmllbGQgPT4ge1xuICAgIGlmICh0eXBlb2YgcGtnRmllbGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gY2hlY2tQa2dGaWVsZFN0cmluZyhwa2dGaWVsZClcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIHBrZ0ZpZWxkID09PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIGNoZWNrUGtnRmllbGRPYmplY3QocGtnRmllbGQpXG4gICAgfVxuICB9XG5cbiAgaWYgKHBrZy5wcml2YXRlID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBpZiAocGtnLmJpbikge1xuICAgIGlmIChjaGVja1BrZ0ZpZWxkKHBrZy5iaW4pKSB7XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIH1cbiAgfVxuXG4gIGlmIChwa2cuYnJvd3Nlcikge1xuICAgIGlmIChjaGVja1BrZ0ZpZWxkKHBrZy5icm93c2VyKSkge1xuICAgICAgcmV0dXJuIHRydWVcbiAgICB9XG4gIH1cblxuICBpZiAocGtnLm1haW4pIHtcbiAgICBpZiAoY2hlY2tQa2dGaWVsZFN0cmluZyhwa2cubWFpbikpIHtcbiAgICAgIHJldHVybiB0cnVlXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZhbHNlXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgZG9jczogeyB1cmw6IGRvY3NVcmwoJ25vLXVudXNlZC1tb2R1bGVzJykgfSxcbiAgICBzY2hlbWE6IFt7XG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIHNyYzoge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnZmlsZXMvcGF0aHMgdG8gYmUgYW5hbHl6ZWQgKG9ubHkgZm9yIHVudXNlZCBleHBvcnRzKScsXG4gICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICBtaW5JdGVtczogMSxcbiAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICBtaW5MZW5ndGg6IDEsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaWdub3JlRXhwb3J0czoge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOlxuICAgICAgICAgICAgJ2ZpbGVzL3BhdGhzIGZvciB3aGljaCB1bnVzZWQgZXhwb3J0cyB3aWxsIG5vdCBiZSByZXBvcnRlZCAoZS5nIG1vZHVsZSBlbnRyeSBwb2ludHMpJyxcbiAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgIG1pbkl0ZW1zOiAxLFxuICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgIG1pbkxlbmd0aDogMSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBtaXNzaW5nRXhwb3J0czoge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAncmVwb3J0IG1vZHVsZXMgd2l0aG91dCBhbnkgZXhwb3J0cycsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICB9LFxuICAgICAgICB1bnVzZWRFeHBvcnRzOiB7XG4gICAgICAgICAgZGVzY3JpcHRpb246ICdyZXBvcnQgZXhwb3J0cyB3aXRob3V0IGFueSB1c2FnZScsXG4gICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG5vdDoge1xuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgdW51c2VkRXhwb3J0czogeyBlbnVtOiBbZmFsc2VdIH0sXG4gICAgICAgICAgbWlzc2luZ0V4cG9ydHM6IHsgZW51bTogW2ZhbHNlXSB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGFueU9mOlt7XG4gICAgICAgIG5vdDoge1xuICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIHVudXNlZEV4cG9ydHM6IHsgZW51bTogW3RydWVdIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnbWlzc2luZ0V4cG9ydHMnXSxcbiAgICAgIH0sIHtcbiAgICAgICAgbm90OiB7XG4gICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgbWlzc2luZ0V4cG9ydHM6IHsgZW51bTogW3RydWVdIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsndW51c2VkRXhwb3J0cyddLFxuICAgICAgfSwge1xuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgdW51c2VkRXhwb3J0czogeyBlbnVtOiBbdHJ1ZV0gfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsndW51c2VkRXhwb3J0cyddLFxuICAgICAgfSwge1xuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgbWlzc2luZ0V4cG9ydHM6IHsgZW51bTogW3RydWVdIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ21pc3NpbmdFeHBvcnRzJ10sXG4gICAgICB9XSxcbiAgICB9XSxcbiAgfSxcblxuICBjcmVhdGU6IGNvbnRleHQgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgIHNyYyxcbiAgICAgIGlnbm9yZUV4cG9ydHMgPSBbXSxcbiAgICAgIG1pc3NpbmdFeHBvcnRzLFxuICAgICAgdW51c2VkRXhwb3J0cyxcbiAgICB9ID0gY29udGV4dC5vcHRpb25zWzBdIHx8IHt9XG5cbiAgICBpZiAodW51c2VkRXhwb3J0cyAmJiAhcHJlcGFyYXRpb25Eb25lKSB7XG4gICAgICBkb1ByZXBhcmF0aW9uKHNyYywgaWdub3JlRXhwb3J0cywgY29udGV4dClcbiAgICB9XG5cbiAgICBjb25zdCBmaWxlID0gY29udGV4dC5nZXRGaWxlbmFtZSgpXG5cbiAgICBjb25zdCBjaGVja0V4cG9ydFByZXNlbmNlID0gbm9kZSA9PiB7XG4gICAgICBpZiAoIW1pc3NpbmdFeHBvcnRzKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBpZiAoaWdub3JlZEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgY29uc3QgZXhwb3J0Q291bnQgPSBleHBvcnRMaXN0LmdldChmaWxlKVxuICAgICAgY29uc3QgZXhwb3J0QWxsID0gZXhwb3J0Q291bnQuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG4gICAgICBjb25zdCBuYW1lc3BhY2VJbXBvcnRzID0gZXhwb3J0Q291bnQuZ2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSKVxuXG4gICAgICBleHBvcnRDb3VudC5kZWxldGUoRVhQT1JUX0FMTF9ERUNMQVJBVElPTilcbiAgICAgIGV4cG9ydENvdW50LmRlbGV0ZShJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUilcbiAgICAgIGlmIChtaXNzaW5nRXhwb3J0cyAmJiBleHBvcnRDb3VudC5zaXplIDwgMSkge1xuICAgICAgICAvLyBub2RlLmJvZHlbMF0gPT09ICd1bmRlZmluZWQnIG9ubHkgaGFwcGVucywgaWYgZXZlcnl0aGluZyBpcyBjb21tZW50ZWQgb3V0IGluIHRoZSBmaWxlXG4gICAgICAgIC8vIGJlaW5nIGxpbnRlZFxuICAgICAgICBjb250ZXh0LnJlcG9ydChub2RlLmJvZHlbMF0gPyBub2RlLmJvZHlbMF0gOiBub2RlLCAnTm8gZXhwb3J0cyBmb3VuZCcpXG4gICAgICB9XG4gICAgICBleHBvcnRDb3VudC5zZXQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTiwgZXhwb3J0QWxsKVxuICAgICAgZXhwb3J0Q291bnQuc2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSLCBuYW1lc3BhY2VJbXBvcnRzKVxuICAgIH1cblxuICAgIGNvbnN0IGNoZWNrVXNhZ2UgPSAobm9kZSwgZXhwb3J0ZWRWYWx1ZSkgPT4ge1xuICAgICAgaWYgKCF1bnVzZWRFeHBvcnRzKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBpZiAoaWdub3JlZEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgaWYgKGZpbGVJc0luUGtnKGZpbGUpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBpZiAoZmlsZXNPdXRzaWRlU3JjLmhhcyhmaWxlKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgLy8gbWFrZSBzdXJlIGZpbGUgdG8gYmUgbGludGVkIGlzIGluY2x1ZGVkIGluIHNvdXJjZSBmaWxlc1xuICAgICAgaWYgKCFzcmNGaWxlcy5oYXMoZmlsZSkpIHtcbiAgICAgICAgc3JjRmlsZXMgPSByZXNvbHZlRmlsZXMoZ2V0U3JjKHNyYyksIGlnbm9yZUV4cG9ydHMpXG4gICAgICAgIGlmICghc3JjRmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgZmlsZXNPdXRzaWRlU3JjLmFkZChmaWxlKVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldChmaWxlKVxuXG4gICAgICAvLyBzcGVjaWFsIGNhc2U6IGV4cG9ydCAqIGZyb21cbiAgICAgIGNvbnN0IGV4cG9ydEFsbCA9IGV4cG9ydHMuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG4gICAgICBpZiAodHlwZW9mIGV4cG9ydEFsbCAhPT0gJ3VuZGVmaW5lZCcgJiYgZXhwb3J0ZWRWYWx1ZSAhPT0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKSB7XG4gICAgICAgIGlmIChleHBvcnRBbGwud2hlcmVVc2VkLnNpemUgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc3BlY2lhbCBjYXNlOiBuYW1lc3BhY2UgaW1wb3J0XG4gICAgICBjb25zdCBuYW1lc3BhY2VJbXBvcnRzID0gZXhwb3J0cy5nZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpXG4gICAgICBpZiAodHlwZW9mIG5hbWVzcGFjZUltcG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmIChuYW1lc3BhY2VJbXBvcnRzLndoZXJlVXNlZC5zaXplID4gMCkge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGV4cG9ydFN0YXRlbWVudCA9IGV4cG9ydHMuZ2V0KGV4cG9ydGVkVmFsdWUpXG5cbiAgICAgIGNvbnN0IHZhbHVlID0gZXhwb3J0ZWRWYWx1ZSA9PT0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSID8gREVGQVVMVCA6IGV4cG9ydGVkVmFsdWVcblxuICAgICAgaWYgKHR5cGVvZiBleHBvcnRTdGF0ZW1lbnQgIT09ICd1bmRlZmluZWQnKXtcbiAgICAgICAgaWYgKGV4cG9ydFN0YXRlbWVudC53aGVyZVVzZWQuc2l6ZSA8IDEpIHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydChcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBgZXhwb3J0ZWQgZGVjbGFyYXRpb24gJyR7dmFsdWV9JyBub3QgdXNlZCB3aXRoaW4gb3RoZXIgbW9kdWxlc2BcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRleHQucmVwb3J0KFxuICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgYGV4cG9ydGVkIGRlY2xhcmF0aW9uICcke3ZhbHVlfScgbm90IHVzZWQgd2l0aGluIG90aGVyIG1vZHVsZXNgXG4gICAgICAgIClcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBvbmx5IHVzZWZ1bCBmb3IgdG9vbHMgbGlrZSB2c2NvZGUtZXNsaW50XG4gICAgICpcbiAgICAgKiB1cGRhdGUgbGlzdHMgb2YgZXhpc3RpbmcgZXhwb3J0cyBkdXJpbmcgcnVudGltZVxuICAgICAqL1xuICAgIGNvbnN0IHVwZGF0ZUV4cG9ydFVzYWdlID0gbm9kZSA9PiB7XG4gICAgICBpZiAoaWdub3JlZEZpbGVzLmhhcyhmaWxlKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbGV0IGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldChmaWxlKVxuXG4gICAgICAvLyBuZXcgbW9kdWxlIGhhcyBiZWVuIGNyZWF0ZWQgZHVyaW5nIHJ1bnRpbWVcbiAgICAgIC8vIGluY2x1ZGUgaXQgaW4gZnVydGhlciBwcm9jZXNzaW5nXG4gICAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGV4cG9ydHMgPSBuZXcgTWFwKClcbiAgICAgIH1cblxuICAgICAgY29uc3QgbmV3RXhwb3J0cyA9IG5ldyBNYXAoKVxuICAgICAgY29uc3QgbmV3RXhwb3J0SWRlbnRpZmllcnMgPSBuZXcgU2V0KClcblxuICAgICAgbm9kZS5ib2R5LmZvckVhY2goKHsgdHlwZSwgZGVjbGFyYXRpb24sIHNwZWNpZmllcnMgfSkgPT4ge1xuICAgICAgICBpZiAodHlwZSA9PT0gRVhQT1JUX0RFRkFVTFRfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICBuZXdFeHBvcnRJZGVudGlmaWVycy5hZGQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKVxuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlID09PSBFWFBPUlRfTkFNRURfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICBpZiAoc3BlY2lmaWVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBzcGVjaWZpZXJzLmZvckVhY2goc3BlY2lmaWVyID0+IHtcbiAgICAgICAgICAgICAgaWYgKHNwZWNpZmllci5leHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIG5ld0V4cG9ydElkZW50aWZpZXJzLmFkZChzcGVjaWZpZXIuZXhwb3J0ZWQubmFtZSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGRlY2xhcmF0aW9uKSB7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIGRlY2xhcmF0aW9uLnR5cGUgPT09IEZVTkNUSU9OX0RFQ0xBUkFUSU9OIHx8XG4gICAgICAgICAgICAgIGRlY2xhcmF0aW9uLnR5cGUgPT09IENMQVNTX0RFQ0xBUkFUSU9OXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgbmV3RXhwb3J0SWRlbnRpZmllcnMuYWRkKGRlY2xhcmF0aW9uLmlkLm5hbWUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGVjbGFyYXRpb24udHlwZSA9PT0gVkFSSUFCTEVfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICAgICAgZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zLmZvckVhY2goKHsgaWQgfSkgPT4ge1xuICAgICAgICAgICAgICAgIG5ld0V4cG9ydElkZW50aWZpZXJzLmFkZChpZC5uYW1lKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgLy8gb2xkIGV4cG9ydHMgZXhpc3Qgd2l0aGluIGxpc3Qgb2YgbmV3IGV4cG9ydHMgaWRlbnRpZmllcnM6IGFkZCB0byBtYXAgb2YgbmV3IGV4cG9ydHNcbiAgICAgIGV4cG9ydHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAobmV3RXhwb3J0SWRlbnRpZmllcnMuaGFzKGtleSkpIHtcbiAgICAgICAgICBuZXdFeHBvcnRzLnNldChrZXksIHZhbHVlKVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICAvLyBuZXcgZXhwb3J0IGlkZW50aWZpZXJzIGFkZGVkOiBhZGQgdG8gbWFwIG9mIG5ldyBleHBvcnRzXG4gICAgICBuZXdFeHBvcnRJZGVudGlmaWVycy5mb3JFYWNoKGtleSA9PiB7XG4gICAgICAgIGlmICghZXhwb3J0cy5oYXMoa2V5KSkge1xuICAgICAgICAgIG5ld0V4cG9ydHMuc2V0KGtleSwgeyB3aGVyZVVzZWQ6IG5ldyBTZXQoKSB9KVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICAvLyBwcmVzZXJ2ZSBpbmZvcm1hdGlvbiBhYm91dCBuYW1lc3BhY2UgaW1wb3J0c1xuICAgICAgbGV0IGV4cG9ydEFsbCA9IGV4cG9ydHMuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG4gICAgICBsZXQgbmFtZXNwYWNlSW1wb3J0cyA9IGV4cG9ydHMuZ2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSKVxuXG4gICAgICBpZiAodHlwZW9mIG5hbWVzcGFjZUltcG9ydHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG5hbWVzcGFjZUltcG9ydHMgPSB7IHdoZXJlVXNlZDogbmV3IFNldCgpIH1cbiAgICAgIH1cblxuICAgICAgbmV3RXhwb3J0cy5zZXQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTiwgZXhwb3J0QWxsKVxuICAgICAgbmV3RXhwb3J0cy5zZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIsIG5hbWVzcGFjZUltcG9ydHMpXG4gICAgICBleHBvcnRMaXN0LnNldChmaWxlLCBuZXdFeHBvcnRzKVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIG9ubHkgdXNlZnVsIGZvciB0b29scyBsaWtlIHZzY29kZS1lc2xpbnRcbiAgICAgKlxuICAgICAqIHVwZGF0ZSBsaXN0cyBvZiBleGlzdGluZyBpbXBvcnRzIGR1cmluZyBydW50aW1lXG4gICAgICovXG4gICAgY29uc3QgdXBkYXRlSW1wb3J0VXNhZ2UgPSBub2RlID0+IHtcbiAgICAgIGlmICghdW51c2VkRXhwb3J0cykge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbGV0IG9sZEltcG9ydFBhdGhzID0gaW1wb3J0TGlzdC5nZXQoZmlsZSlcbiAgICAgIGlmICh0eXBlb2Ygb2xkSW1wb3J0UGF0aHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG9sZEltcG9ydFBhdGhzID0gbmV3IE1hcCgpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9sZE5hbWVzcGFjZUltcG9ydHMgPSBuZXcgU2V0KClcbiAgICAgIGNvbnN0IG5ld05hbWVzcGFjZUltcG9ydHMgPSBuZXcgU2V0KClcblxuICAgICAgY29uc3Qgb2xkRXhwb3J0QWxsID0gbmV3IFNldCgpXG4gICAgICBjb25zdCBuZXdFeHBvcnRBbGwgPSBuZXcgU2V0KClcblxuICAgICAgY29uc3Qgb2xkRGVmYXVsdEltcG9ydHMgPSBuZXcgU2V0KClcbiAgICAgIGNvbnN0IG5ld0RlZmF1bHRJbXBvcnRzID0gbmV3IFNldCgpXG5cbiAgICAgIGNvbnN0IG9sZEltcG9ydHMgPSBuZXcgTWFwKClcbiAgICAgIGNvbnN0IG5ld0ltcG9ydHMgPSBuZXcgTWFwKClcbiAgICAgIG9sZEltcG9ydFBhdGhzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgaWYgKHZhbHVlLmhhcyhFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OKSkge1xuICAgICAgICAgIG9sZEV4cG9ydEFsbC5hZGQoa2V5KVxuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZS5oYXMoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpKSB7XG4gICAgICAgICAgb2xkTmFtZXNwYWNlSW1wb3J0cy5hZGQoa2V5KVxuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZS5oYXMoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKSkge1xuICAgICAgICAgIG9sZERlZmF1bHRJbXBvcnRzLmFkZChrZXkpXG4gICAgICAgIH1cbiAgICAgICAgdmFsdWUuZm9yRWFjaCh2YWwgPT4ge1xuICAgICAgICAgIGlmICh2YWwgIT09IElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSICYmXG4gICAgICAgICAgICAgIHZhbCAhPT0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKSB7XG4gICAgICAgICAgICAgICBvbGRJbXBvcnRzLnNldCh2YWwsIGtleSlcbiAgICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9KVxuXG4gICAgICBub2RlLmJvZHkuZm9yRWFjaChhc3ROb2RlID0+IHtcbiAgICAgICAgbGV0IHJlc29sdmVkUGF0aFxuXG4gICAgICAgIC8vIHN1cHBvcnQgZm9yIGV4cG9ydCB7IHZhbHVlIH0gZnJvbSAnbW9kdWxlJ1xuICAgICAgICBpZiAoYXN0Tm9kZS50eXBlID09PSBFWFBPUlRfTkFNRURfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICBpZiAoYXN0Tm9kZS5zb3VyY2UpIHtcbiAgICAgICAgICAgIHJlc29sdmVkUGF0aCA9IHJlc29sdmUoYXN0Tm9kZS5zb3VyY2UucmF3LnJlcGxhY2UoLygnfFwiKS9nLCAnJyksIGNvbnRleHQpXG4gICAgICAgICAgICBhc3ROb2RlLnNwZWNpZmllcnMuZm9yRWFjaChzcGVjaWZpZXIgPT4ge1xuICAgICAgICAgICAgICBsZXQgbmFtZVxuICAgICAgICAgICAgICBpZiAoc3BlY2lmaWVyLmV4cG9ydGVkLm5hbWUgPT09IERFRkFVTFQpIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmFtZSA9IHNwZWNpZmllci5sb2NhbC5uYW1lXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgbmV3SW1wb3J0cy5zZXQobmFtZSwgcmVzb2x2ZWRQYXRoKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXN0Tm9kZS50eXBlID09PSBFWFBPUlRfQUxMX0RFQ0xBUkFUSU9OKSB7XG4gICAgICAgICAgcmVzb2x2ZWRQYXRoID0gcmVzb2x2ZShhc3ROb2RlLnNvdXJjZS5yYXcucmVwbGFjZSgvKCd8XCIpL2csICcnKSwgY29udGV4dClcbiAgICAgICAgICBuZXdFeHBvcnRBbGwuYWRkKHJlc29sdmVkUGF0aClcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhc3ROb2RlLnR5cGUgPT09IElNUE9SVF9ERUNMQVJBVElPTikge1xuICAgICAgICAgIHJlc29sdmVkUGF0aCA9IHJlc29sdmUoYXN0Tm9kZS5zb3VyY2UucmF3LnJlcGxhY2UoLygnfFwiKS9nLCAnJyksIGNvbnRleHQpXG4gICAgICAgICAgaWYgKCFyZXNvbHZlZFBhdGgpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChpc05vZGVNb2R1bGUocmVzb2x2ZWRQYXRoKSkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5ld05hbWVzcGFjZUltcG9ydEV4aXN0cyhhc3ROb2RlLnNwZWNpZmllcnMpKSB7XG4gICAgICAgICAgICBuZXdOYW1lc3BhY2VJbXBvcnRzLmFkZChyZXNvbHZlZFBhdGgpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5ld0RlZmF1bHRJbXBvcnRFeGlzdHMoYXN0Tm9kZS5zcGVjaWZpZXJzKSkge1xuICAgICAgICAgICAgbmV3RGVmYXVsdEltcG9ydHMuYWRkKHJlc29sdmVkUGF0aClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhc3ROb2RlLnNwZWNpZmllcnMuZm9yRWFjaChzcGVjaWZpZXIgPT4ge1xuICAgICAgICAgICAgaWYgKHNwZWNpZmllci50eXBlID09PSBJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIgfHxcbiAgICAgICAgICAgICAgICBzcGVjaWZpZXIudHlwZSA9PT0gSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpIHtcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXdJbXBvcnRzLnNldChzcGVjaWZpZXIuaW1wb3J0ZWQubmFtZSwgcmVzb2x2ZWRQYXRoKVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIG5ld0V4cG9ydEFsbC5mb3JFYWNoKHZhbHVlID0+IHtcbiAgICAgICAgaWYgKCFvbGRFeHBvcnRBbGwuaGFzKHZhbHVlKSkge1xuICAgICAgICAgIGxldCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKVxuICAgICAgICAgIGlmICh0eXBlb2YgaW1wb3J0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGltcG9ydHMgPSBuZXcgU2V0KClcbiAgICAgICAgICB9XG4gICAgICAgICAgaW1wb3J0cy5hZGQoRVhQT1JUX0FMTF9ERUNMQVJBVElPTilcbiAgICAgICAgICBvbGRJbXBvcnRQYXRocy5zZXQodmFsdWUsIGltcG9ydHMpXG5cbiAgICAgICAgICBsZXQgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKVxuICAgICAgICAgIGxldCBjdXJyZW50RXhwb3J0XG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY3VycmVudEV4cG9ydCA9IGV4cG9ydHMuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cG9ydHMgPSBuZXcgTWFwKClcbiAgICAgICAgICAgIGV4cG9ydExpc3Quc2V0KHZhbHVlLCBleHBvcnRzKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0eXBlb2YgY3VycmVudEV4cG9ydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQud2hlcmVVc2VkLmFkZChmaWxlKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB3aGVyZVVzZWQgPSBuZXcgU2V0KClcbiAgICAgICAgICAgIHdoZXJlVXNlZC5hZGQoZmlsZSlcbiAgICAgICAgICAgIGV4cG9ydHMuc2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04sIHsgd2hlcmVVc2VkIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBvbGRFeHBvcnRBbGwuZm9yRWFjaCh2YWx1ZSA9PiB7XG4gICAgICAgIGlmICghbmV3RXhwb3J0QWxsLmhhcyh2YWx1ZSkpIHtcbiAgICAgICAgICBjb25zdCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKVxuICAgICAgICAgIGltcG9ydHMuZGVsZXRlKEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG5cbiAgICAgICAgICBjb25zdCBleHBvcnRzID0gZXhwb3J0TGlzdC5nZXQodmFsdWUpXG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudEV4cG9ydCA9IGV4cG9ydHMuZ2V0KEVYUE9SVF9BTExfREVDTEFSQVRJT04pXG4gICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRFeHBvcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQud2hlcmVVc2VkLmRlbGV0ZShmaWxlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgbmV3RGVmYXVsdEltcG9ydHMuZm9yRWFjaCh2YWx1ZSA9PiB7XG4gICAgICAgIGlmICghb2xkRGVmYXVsdEltcG9ydHMuaGFzKHZhbHVlKSkge1xuICAgICAgICAgIGxldCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKVxuICAgICAgICAgIGlmICh0eXBlb2YgaW1wb3J0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGltcG9ydHMgPSBuZXcgU2V0KClcbiAgICAgICAgICB9XG4gICAgICAgICAgaW1wb3J0cy5hZGQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKVxuICAgICAgICAgIG9sZEltcG9ydFBhdGhzLnNldCh2YWx1ZSwgaW1wb3J0cylcblxuICAgICAgICAgIGxldCBleHBvcnRzID0gZXhwb3J0TGlzdC5nZXQodmFsdWUpXG4gICAgICAgICAgbGV0IGN1cnJlbnRFeHBvcnRcbiAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjdXJyZW50RXhwb3J0ID0gZXhwb3J0cy5nZXQoSU1QT1JUX0RFRkFVTFRfU1BFQ0lGSUVSKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHBvcnRzID0gbmV3IE1hcCgpXG4gICAgICAgICAgICBleHBvcnRMaXN0LnNldCh2YWx1ZSwgZXhwb3J0cylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRFeHBvcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjdXJyZW50RXhwb3J0LndoZXJlVXNlZC5hZGQoZmlsZSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgd2hlcmVVc2VkID0gbmV3IFNldCgpXG4gICAgICAgICAgICB3aGVyZVVzZWQuYWRkKGZpbGUpXG4gICAgICAgICAgICBleHBvcnRzLnNldChJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIsIHsgd2hlcmVVc2VkIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBvbGREZWZhdWx0SW1wb3J0cy5mb3JFYWNoKHZhbHVlID0+IHtcbiAgICAgICAgaWYgKCFuZXdEZWZhdWx0SW1wb3J0cy5oYXModmFsdWUpKSB7XG4gICAgICAgICAgY29uc3QgaW1wb3J0cyA9IG9sZEltcG9ydFBhdGhzLmdldCh2YWx1ZSlcbiAgICAgICAgICBpbXBvcnRzLmRlbGV0ZShJTVBPUlRfREVGQVVMVF9TUEVDSUZJRVIpXG5cbiAgICAgICAgICBjb25zdCBleHBvcnRzID0gZXhwb3J0TGlzdC5nZXQodmFsdWUpXG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudEV4cG9ydCA9IGV4cG9ydHMuZ2V0KElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUilcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY3VycmVudEV4cG9ydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgY3VycmVudEV4cG9ydC53aGVyZVVzZWQuZGVsZXRlKGZpbGUpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBuZXdOYW1lc3BhY2VJbXBvcnRzLmZvckVhY2godmFsdWUgPT4ge1xuICAgICAgICBpZiAoIW9sZE5hbWVzcGFjZUltcG9ydHMuaGFzKHZhbHVlKSkge1xuICAgICAgICAgIGxldCBpbXBvcnRzID0gb2xkSW1wb3J0UGF0aHMuZ2V0KHZhbHVlKVxuICAgICAgICAgIGlmICh0eXBlb2YgaW1wb3J0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGltcG9ydHMgPSBuZXcgU2V0KClcbiAgICAgICAgICB9XG4gICAgICAgICAgaW1wb3J0cy5hZGQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpXG4gICAgICAgICAgb2xkSW1wb3J0UGF0aHMuc2V0KHZhbHVlLCBpbXBvcnRzKVxuXG4gICAgICAgICAgbGV0IGV4cG9ydHMgPSBleHBvcnRMaXN0LmdldCh2YWx1ZSlcbiAgICAgICAgICBsZXQgY3VycmVudEV4cG9ydFxuICAgICAgICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQgPSBleHBvcnRzLmdldChJTVBPUlRfTkFNRVNQQUNFX1NQRUNJRklFUilcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwb3J0cyA9IG5ldyBNYXAoKVxuICAgICAgICAgICAgZXhwb3J0TGlzdC5zZXQodmFsdWUsIGV4cG9ydHMpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50RXhwb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY3VycmVudEV4cG9ydC53aGVyZVVzZWQuYWRkKGZpbGUpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHdoZXJlVXNlZCA9IG5ldyBTZXQoKVxuICAgICAgICAgICAgd2hlcmVVc2VkLmFkZChmaWxlKVxuICAgICAgICAgICAgZXhwb3J0cy5zZXQoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIsIHsgd2hlcmVVc2VkIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuXG4gICAgICBvbGROYW1lc3BhY2VJbXBvcnRzLmZvckVhY2godmFsdWUgPT4ge1xuICAgICAgICBpZiAoIW5ld05hbWVzcGFjZUltcG9ydHMuaGFzKHZhbHVlKSkge1xuICAgICAgICAgIGNvbnN0IGltcG9ydHMgPSBvbGRJbXBvcnRQYXRocy5nZXQodmFsdWUpXG4gICAgICAgICAgaW1wb3J0cy5kZWxldGUoSU1QT1JUX05BTUVTUEFDRV9TUEVDSUZJRVIpXG5cbiAgICAgICAgICBjb25zdCBleHBvcnRzID0gZXhwb3J0TGlzdC5nZXQodmFsdWUpXG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudEV4cG9ydCA9IGV4cG9ydHMuZ2V0KElNUE9SVF9OQU1FU1BBQ0VfU1BFQ0lGSUVSKVxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50RXhwb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICBjdXJyZW50RXhwb3J0LndoZXJlVXNlZC5kZWxldGUoZmlsZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIG5ld0ltcG9ydHMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgICBpZiAoIW9sZEltcG9ydHMuaGFzKGtleSkpIHtcbiAgICAgICAgICBsZXQgaW1wb3J0cyA9IG9sZEltcG9ydFBhdGhzLmdldCh2YWx1ZSlcbiAgICAgICAgICBpZiAodHlwZW9mIGltcG9ydHMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpbXBvcnRzID0gbmV3IFNldCgpXG4gICAgICAgICAgfVxuICAgICAgICAgIGltcG9ydHMuYWRkKGtleSlcbiAgICAgICAgICBvbGRJbXBvcnRQYXRocy5zZXQodmFsdWUsIGltcG9ydHMpXG5cbiAgICAgICAgICBsZXQgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKVxuICAgICAgICAgIGxldCBjdXJyZW50RXhwb3J0XG4gICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY3VycmVudEV4cG9ydCA9IGV4cG9ydHMuZ2V0KGtleSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwb3J0cyA9IG5ldyBNYXAoKVxuICAgICAgICAgICAgZXhwb3J0TGlzdC5zZXQodmFsdWUsIGV4cG9ydHMpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50RXhwb3J0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY3VycmVudEV4cG9ydC53aGVyZVVzZWQuYWRkKGZpbGUpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHdoZXJlVXNlZCA9IG5ldyBTZXQoKVxuICAgICAgICAgICAgd2hlcmVVc2VkLmFkZChmaWxlKVxuICAgICAgICAgICAgZXhwb3J0cy5zZXQoa2V5LCB7IHdoZXJlVXNlZCB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgb2xkSW1wb3J0cy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICAgIGlmICghbmV3SW1wb3J0cy5oYXMoa2V5KSkge1xuICAgICAgICAgIGNvbnN0IGltcG9ydHMgPSBvbGRJbXBvcnRQYXRocy5nZXQodmFsdWUpXG4gICAgICAgICAgaW1wb3J0cy5kZWxldGUoa2V5KVxuXG4gICAgICAgICAgY29uc3QgZXhwb3J0cyA9IGV4cG9ydExpc3QuZ2V0KHZhbHVlKVxuICAgICAgICAgIGlmICh0eXBlb2YgZXhwb3J0cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRFeHBvcnQgPSBleHBvcnRzLmdldChrZXkpXG4gICAgICAgICAgICBpZiAodHlwZW9mIGN1cnJlbnRFeHBvcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnRFeHBvcnQud2hlcmVVc2VkLmRlbGV0ZShmaWxlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgJ1Byb2dyYW06ZXhpdCc6IG5vZGUgPT4ge1xuICAgICAgICB1cGRhdGVFeHBvcnRVc2FnZShub2RlKVxuICAgICAgICB1cGRhdGVJbXBvcnRVc2FnZShub2RlKVxuICAgICAgICBjaGVja0V4cG9ydFByZXNlbmNlKG5vZGUpXG4gICAgICB9LFxuICAgICAgJ0V4cG9ydERlZmF1bHREZWNsYXJhdGlvbic6IG5vZGUgPT4ge1xuICAgICAgICBjaGVja1VzYWdlKG5vZGUsIElNUE9SVF9ERUZBVUxUX1NQRUNJRklFUilcbiAgICAgIH0sXG4gICAgICAnRXhwb3J0TmFtZWREZWNsYXJhdGlvbic6IG5vZGUgPT4ge1xuICAgICAgICBub2RlLnNwZWNpZmllcnMuZm9yRWFjaChzcGVjaWZpZXIgPT4ge1xuICAgICAgICAgICAgY2hlY2tVc2FnZShub2RlLCBzcGVjaWZpZXIuZXhwb3J0ZWQubmFtZSlcbiAgICAgICAgfSlcbiAgICAgICAgaWYgKG5vZGUuZGVjbGFyYXRpb24pIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBub2RlLmRlY2xhcmF0aW9uLnR5cGUgPT09IEZVTkNUSU9OX0RFQ0xBUkFUSU9OIHx8XG4gICAgICAgICAgICBub2RlLmRlY2xhcmF0aW9uLnR5cGUgPT09IENMQVNTX0RFQ0xBUkFUSU9OXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjaGVja1VzYWdlKG5vZGUsIG5vZGUuZGVjbGFyYXRpb24uaWQubmFtZSlcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG5vZGUuZGVjbGFyYXRpb24udHlwZSA9PT0gVkFSSUFCTEVfREVDTEFSQVRJT04pIHtcbiAgICAgICAgICAgIG5vZGUuZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zLmZvckVhY2goZGVjbGFyYXRpb24gPT4ge1xuICAgICAgICAgICAgICBjaGVja1VzYWdlKG5vZGUsIGRlY2xhcmF0aW9uLmlkLm5hbWUpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=