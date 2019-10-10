'use strict';

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      url: (0, _docsUrl2.default)('prefer-default-export')
    }
  },

  create: function (context) {
    let specifierExportCount = 0;
    let hasDefaultExport = false;
    let hasStarExport = false;
    let namedExportNode = null;

    function captureDeclaration(identifierOrPattern) {
      if (identifierOrPattern.type === 'ObjectPattern') {
        // recursively capture
        identifierOrPattern.properties.forEach(function (property) {
          captureDeclaration(property.value);
        });
      } else if (identifierOrPattern.type === 'ArrayPattern') {
        identifierOrPattern.elements.forEach(captureDeclaration);
      } else {
        // assume it's a single standard identifier
        specifierExportCount++;
      }
    }

    return {
      'ExportDefaultSpecifier': function () {
        hasDefaultExport = true;
      },

      'ExportSpecifier': function (node) {
        if (node.exported.name === 'default') {
          hasDefaultExport = true;
        } else {
          specifierExportCount++;
          namedExportNode = node;
        }
      },

      'ExportNamedDeclaration': function (node) {
        // if there are specifiers, node.declaration should be null
        if (!node.declaration) return;

        // don't warn on single type aliases, declarations, or interfaces
        if (node.exportKind === 'type') return;

        const type = node.declaration.type;


        if (type === 'TSTypeAliasDeclaration' || type === 'TypeAlias' || type === 'TSInterfaceDeclaration' || type === 'InterfaceDeclaration') {
          return;
        }

        if (node.declaration.declarations) {
          node.declaration.declarations.forEach(function (declaration) {
            captureDeclaration(declaration.id);
          });
        } else {
          // captures 'export function foo() {}' syntax
          specifierExportCount++;
        }

        namedExportNode = node;
      },

      'ExportDefaultDeclaration': function () {
        hasDefaultExport = true;
      },

      'ExportAllDeclaration': function () {
        hasStarExport = true;
      },

      'Program:exit': function () {
        if (specifierExportCount === 1 && !hasDefaultExport && !hasStarExport) {
          context.report(namedExportNode, 'Prefer default export.');
        }
      }
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9wcmVmZXItZGVmYXVsdC1leHBvcnQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJ0eXBlIiwiZG9jcyIsInVybCIsImNyZWF0ZSIsImNvbnRleHQiLCJzcGVjaWZpZXJFeHBvcnRDb3VudCIsImhhc0RlZmF1bHRFeHBvcnQiLCJoYXNTdGFyRXhwb3J0IiwibmFtZWRFeHBvcnROb2RlIiwiY2FwdHVyZURlY2xhcmF0aW9uIiwiaWRlbnRpZmllck9yUGF0dGVybiIsInByb3BlcnRpZXMiLCJmb3JFYWNoIiwicHJvcGVydHkiLCJ2YWx1ZSIsImVsZW1lbnRzIiwibm9kZSIsImV4cG9ydGVkIiwibmFtZSIsImRlY2xhcmF0aW9uIiwiZXhwb3J0S2luZCIsImRlY2xhcmF0aW9ucyIsImlkIiwicmVwb3J0Il0sIm1hcHBpbmdzIjoiQUFBQTs7QUFFQTs7Ozs7O0FBRUFBLE9BQU9DLE9BQVAsR0FBaUI7QUFDZkMsUUFBTTtBQUNKQyxVQUFNLFlBREY7QUFFSkMsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLHVCQUFSO0FBREQ7QUFGRixHQURTOztBQVFmQyxVQUFRLFVBQVNDLE9BQVQsRUFBa0I7QUFDeEIsUUFBSUMsdUJBQXVCLENBQTNCO0FBQ0EsUUFBSUMsbUJBQW1CLEtBQXZCO0FBQ0EsUUFBSUMsZ0JBQWdCLEtBQXBCO0FBQ0EsUUFBSUMsa0JBQWtCLElBQXRCOztBQUVBLGFBQVNDLGtCQUFULENBQTRCQyxtQkFBNUIsRUFBaUQ7QUFDL0MsVUFBSUEsb0JBQW9CVixJQUFwQixLQUE2QixlQUFqQyxFQUFrRDtBQUNoRDtBQUNBVSw0QkFBb0JDLFVBQXBCLENBQ0dDLE9BREgsQ0FDVyxVQUFTQyxRQUFULEVBQW1CO0FBQzFCSiw2QkFBbUJJLFNBQVNDLEtBQTVCO0FBQ0QsU0FISDtBQUlELE9BTkQsTUFNTyxJQUFJSixvQkFBb0JWLElBQXBCLEtBQTZCLGNBQWpDLEVBQWlEO0FBQ3REVSw0QkFBb0JLLFFBQXBCLENBQ0dILE9BREgsQ0FDV0gsa0JBRFg7QUFFRCxPQUhNLE1BR0M7QUFDUjtBQUNFSjtBQUNEO0FBQ0Y7O0FBRUQsV0FBTztBQUNMLGdDQUEwQixZQUFXO0FBQ25DQywyQkFBbUIsSUFBbkI7QUFDRCxPQUhJOztBQUtMLHlCQUFtQixVQUFTVSxJQUFULEVBQWU7QUFDaEMsWUFBSUEsS0FBS0MsUUFBTCxDQUFjQyxJQUFkLEtBQXVCLFNBQTNCLEVBQXNDO0FBQ3BDWiw2QkFBbUIsSUFBbkI7QUFDRCxTQUZELE1BRU87QUFDTEQ7QUFDQUcsNEJBQWtCUSxJQUFsQjtBQUNEO0FBQ0YsT0FaSTs7QUFjTCxnQ0FBMEIsVUFBU0EsSUFBVCxFQUFlO0FBQ3ZDO0FBQ0EsWUFBSSxDQUFDQSxLQUFLRyxXQUFWLEVBQXVCOztBQUV2QjtBQUNBLFlBQUlILEtBQUtJLFVBQUwsS0FBb0IsTUFBeEIsRUFBZ0M7O0FBTE8sY0FPL0JwQixJQVArQixHQU90QmdCLEtBQUtHLFdBUGlCLENBTy9CbkIsSUFQK0I7OztBQVN2QyxZQUNFQSxTQUFTLHdCQUFULElBQ0FBLFNBQVMsV0FEVCxJQUVBQSxTQUFTLHdCQUZULElBR0FBLFNBQVMsc0JBSlgsRUFLRTtBQUNBO0FBQ0Q7O0FBRUQsWUFBSWdCLEtBQUtHLFdBQUwsQ0FBaUJFLFlBQXJCLEVBQW1DO0FBQ2pDTCxlQUFLRyxXQUFMLENBQWlCRSxZQUFqQixDQUE4QlQsT0FBOUIsQ0FBc0MsVUFBU08sV0FBVCxFQUFzQjtBQUMxRFYsK0JBQW1CVSxZQUFZRyxFQUEvQjtBQUNELFdBRkQ7QUFHRCxTQUpELE1BS0s7QUFDSDtBQUNBakI7QUFDRDs7QUFFREcsMEJBQWtCUSxJQUFsQjtBQUNELE9BM0NJOztBQTZDTCxrQ0FBNEIsWUFBVztBQUNyQ1YsMkJBQW1CLElBQW5CO0FBQ0QsT0EvQ0k7O0FBaURMLDhCQUF3QixZQUFXO0FBQ2pDQyx3QkFBZ0IsSUFBaEI7QUFDRCxPQW5ESTs7QUFxREwsc0JBQWdCLFlBQVc7QUFDekIsWUFBSUYseUJBQXlCLENBQXpCLElBQThCLENBQUNDLGdCQUEvQixJQUFtRCxDQUFDQyxhQUF4RCxFQUF1RTtBQUNyRUgsa0JBQVFtQixNQUFSLENBQWVmLGVBQWYsRUFBZ0Msd0JBQWhDO0FBQ0Q7QUFDRjtBQXpESSxLQUFQO0FBMkREO0FBekZjLENBQWpCIiwiZmlsZSI6InByZWZlci1kZWZhdWx0LWV4cG9ydC5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xuXG5pbXBvcnQgZG9jc1VybCBmcm9tICcuLi9kb2NzVXJsJ1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbWV0YToge1xuICAgIHR5cGU6ICdzdWdnZXN0aW9uJyxcbiAgICBkb2NzOiB7XG4gICAgICB1cmw6IGRvY3NVcmwoJ3ByZWZlci1kZWZhdWx0LWV4cG9ydCcpLFxuICAgIH0sXG4gIH0sXG5cbiAgY3JlYXRlOiBmdW5jdGlvbihjb250ZXh0KSB7XG4gICAgbGV0IHNwZWNpZmllckV4cG9ydENvdW50ID0gMFxuICAgIGxldCBoYXNEZWZhdWx0RXhwb3J0ID0gZmFsc2VcbiAgICBsZXQgaGFzU3RhckV4cG9ydCA9IGZhbHNlXG4gICAgbGV0IG5hbWVkRXhwb3J0Tm9kZSA9IG51bGxcblxuICAgIGZ1bmN0aW9uIGNhcHR1cmVEZWNsYXJhdGlvbihpZGVudGlmaWVyT3JQYXR0ZXJuKSB7XG4gICAgICBpZiAoaWRlbnRpZmllck9yUGF0dGVybi50eXBlID09PSAnT2JqZWN0UGF0dGVybicpIHtcbiAgICAgICAgLy8gcmVjdXJzaXZlbHkgY2FwdHVyZVxuICAgICAgICBpZGVudGlmaWVyT3JQYXR0ZXJuLnByb3BlcnRpZXNcbiAgICAgICAgICAuZm9yRWFjaChmdW5jdGlvbihwcm9wZXJ0eSkge1xuICAgICAgICAgICAgY2FwdHVyZURlY2xhcmF0aW9uKHByb3BlcnR5LnZhbHVlKVxuICAgICAgICAgIH0pXG4gICAgICB9IGVsc2UgaWYgKGlkZW50aWZpZXJPclBhdHRlcm4udHlwZSA9PT0gJ0FycmF5UGF0dGVybicpIHtcbiAgICAgICAgaWRlbnRpZmllck9yUGF0dGVybi5lbGVtZW50c1xuICAgICAgICAgIC5mb3JFYWNoKGNhcHR1cmVEZWNsYXJhdGlvbilcbiAgICAgIH0gZWxzZSAge1xuICAgICAgLy8gYXNzdW1lIGl0J3MgYSBzaW5nbGUgc3RhbmRhcmQgaWRlbnRpZmllclxuICAgICAgICBzcGVjaWZpZXJFeHBvcnRDb3VudCsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICdFeHBvcnREZWZhdWx0U3BlY2lmaWVyJzogZnVuY3Rpb24oKSB7XG4gICAgICAgIGhhc0RlZmF1bHRFeHBvcnQgPSB0cnVlXG4gICAgICB9LFxuXG4gICAgICAnRXhwb3J0U3BlY2lmaWVyJzogZnVuY3Rpb24obm9kZSkge1xuICAgICAgICBpZiAobm9kZS5leHBvcnRlZC5uYW1lID09PSAnZGVmYXVsdCcpIHtcbiAgICAgICAgICBoYXNEZWZhdWx0RXhwb3J0ID0gdHJ1ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNwZWNpZmllckV4cG9ydENvdW50KytcbiAgICAgICAgICBuYW1lZEV4cG9ydE5vZGUgPSBub2RlXG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnROYW1lZERlY2xhcmF0aW9uJzogZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAvLyBpZiB0aGVyZSBhcmUgc3BlY2lmaWVycywgbm9kZS5kZWNsYXJhdGlvbiBzaG91bGQgYmUgbnVsbFxuICAgICAgICBpZiAoIW5vZGUuZGVjbGFyYXRpb24pIHJldHVyblxuXG4gICAgICAgIC8vIGRvbid0IHdhcm4gb24gc2luZ2xlIHR5cGUgYWxpYXNlcywgZGVjbGFyYXRpb25zLCBvciBpbnRlcmZhY2VzXG4gICAgICAgIGlmIChub2RlLmV4cG9ydEtpbmQgPT09ICd0eXBlJykgcmV0dXJuXG5cbiAgICAgICAgY29uc3QgeyB0eXBlIH0gPSBub2RlLmRlY2xhcmF0aW9uXG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgIHR5cGUgPT09ICdUU1R5cGVBbGlhc0RlY2xhcmF0aW9uJyB8fFxuICAgICAgICAgIHR5cGUgPT09ICdUeXBlQWxpYXMnIHx8XG4gICAgICAgICAgdHlwZSA9PT0gJ1RTSW50ZXJmYWNlRGVjbGFyYXRpb24nIHx8XG4gICAgICAgICAgdHlwZSA9PT0gJ0ludGVyZmFjZURlY2xhcmF0aW9uJ1xuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmRlY2xhcmF0aW9uLmRlY2xhcmF0aW9ucykge1xuICAgICAgICAgIG5vZGUuZGVjbGFyYXRpb24uZGVjbGFyYXRpb25zLmZvckVhY2goZnVuY3Rpb24oZGVjbGFyYXRpb24pIHtcbiAgICAgICAgICAgIGNhcHR1cmVEZWNsYXJhdGlvbihkZWNsYXJhdGlvbi5pZClcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIC8vIGNhcHR1cmVzICdleHBvcnQgZnVuY3Rpb24gZm9vKCkge30nIHN5bnRheFxuICAgICAgICAgIHNwZWNpZmllckV4cG9ydENvdW50KytcbiAgICAgICAgfVxuXG4gICAgICAgIG5hbWVkRXhwb3J0Tm9kZSA9IG5vZGVcbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaGFzRGVmYXVsdEV4cG9ydCA9IHRydWVcbiAgICAgIH0sXG5cbiAgICAgICdFeHBvcnRBbGxEZWNsYXJhdGlvbic6IGZ1bmN0aW9uKCkge1xuICAgICAgICBoYXNTdGFyRXhwb3J0ID0gdHJ1ZVxuICAgICAgfSxcblxuICAgICAgJ1Byb2dyYW06ZXhpdCc6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoc3BlY2lmaWVyRXhwb3J0Q291bnQgPT09IDEgJiYgIWhhc0RlZmF1bHRFeHBvcnQgJiYgIWhhc1N0YXJFeHBvcnQpIHtcbiAgICAgICAgICBjb250ZXh0LnJlcG9ydChuYW1lZEV4cG9ydE5vZGUsICdQcmVmZXIgZGVmYXVsdCBleHBvcnQuJylcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9XG4gIH0sXG59XG4iXX0=