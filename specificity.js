/**
 * THIS ENTIRE FILE IS COPIED FROM CSSO (MIT LICENSE):
 * https://github.com/css/csso/blob/e33bd07b4d7e76b76e695c5c8d74cda2b68c9b28/lib/restructure/prepare/specificity.js
 */

import csstree from 'css-tree'

function ensureSelectorList(node) {
  if (node.type === 'Raw') {
    return csstree.parse(node.value, {
      context: 'selectorList',
    });
  }

  return node;
}

function maxSpecificity(a, b) {
  for (var i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i] ? a : b;
    }
  }

  return a;
}

function maxSelectorListSpecificity(selectorList) {
  return ensureSelectorList(selectorList).children.reduce(
    (result, node) => maxSpecificity(specificity(node).specificityArray, result),
    [0, 0, 0]
  );
}

/**
 * §16. Calculating a selector’s specificity
 * @see https://www.w3.org/TR/selectors-4/#specificity-rules
 * @param {string} simpleSelector
 * @param {Object} stringifyNode
 *
 * @typedef {Object} Part
 * @property {string} selector
 * @property {Specificity} specificity - e.g. [0,1,0]
 *
 * @typedef {Object} SpecificityObject
 * @property {Specificity} specificityArray - e.g. [0,1,0]
 * @property {String} specificity - e.g. 0,1,0
 * @property {String} selector - the input
 * @property {Array<Part>} parts - array with details about each part of the selector that counts towards the specificity
 *
 * @returns {SpecificityObject}
 */
function specificity(simpleSelector, stringifyNode) {
  var A = 0;
  var B = 0;
  var C = 0;
  var parts = []

  // A selector’s specificity is calculated for a given element as follows:
  simpleSelector.children.each(function walk(node) {
    const stringified = stringifyNode ? stringifyNode(node) : null
    switch (node.type) {
      // count the number of ID selectors in the selector (= A)
      case 'IdSelector':
        A++;
        parts.push({ specificity: [1, 0, 0], selector: stringified })
        break;

      // count the number of class selectors, attributes selectors, ...
      case 'ClassSelector':
      case 'AttributeSelector':
        B++;
        parts.push({ specificity: [0, 1, 0], selector: stringified })
        break;

      // ... and pseudo-classes in the selector (= B)
      case 'PseudoClassSelector':
        switch (node.name.toLowerCase()) {
          // The specificity of an :is(), :not(), or :has() pseudo-class is replaced
          // by the specificity of the most specific complex selector in its selector list argument.
          case 'not':
          case 'has':
          case 'is':
          // :matches() is used before it was renamed to :is()
          // https://github.com/w3c/csswg-drafts/issues/3258
          case 'matches':
          // Older browsers support :is() functionality as prefixed pseudo-class :any()
          // https://developer.mozilla.org/en-US/docs/Web/CSS/:is
          case '-webkit-any':
          case '-moz-any': {
            var [a, b, c] = maxSelectorListSpecificity(node.children.first());

            A += a;
            B += b;
            C += c;

            parts.push({ specificity: [a, b, c], selector: stringified })

            break;
          }

          // Analogously, the specificity of an :nth-child() or :nth-last-child() selector
          // is the specificity of the pseudo class itself (counting as one pseudo-class selector)
          // plus the specificity of the most specific complex selector in its selector list argument (if any).
          case 'nth-child':
          case 'nth-last-child': {
            var arg = node.children.first();

            if (arg.type === 'Nth' && arg.selector) {
              var [a, b, c] = maxSelectorListSpecificity(arg.selector);

              A += a;
              B += b + 1;
              C += c;
              parts.push({ specificity: [a, b + 1, c], selector: stringified })
            } else {
              B++;
              parts.push({ specificity: [0, 1, 0], selector: stringified })
            }

            break;
          }

          // The specificity of a :where() pseudo-class is replaced by zero.
          case 'where':
            parts.push({ specificity: [0, 0, 0], selector: stringified })
            break;

          // The four Level 2 pseudo-elements (::before, ::after, ::first-line, and ::first-letter) may,
          // for legacy reasons, be represented using the <pseudo-class-selector> grammar,
          // with only a single ":" character at their start.
          // https://www.w3.org/TR/selectors-4/#single-colon-pseudos
          case 'before':
          case 'after':
          case 'first-line':
          case 'first-letter':
            C++;
            parts.push({ specificity: [0, 0, 1], selector: stringified })
            break;

          default:
            parts.push({ specificity: [0, 1, 0], selector: stringified })
            B++;
        }
        break;

      // count the number of type selectors ...
      case 'TypeSelector':
        // ignore the universal selector
        if (!node.name.endsWith('*')) {
          parts.push({ specificity: [0, 0, 1], selector: stringified })
          C++;
        } else {
          parts.push({ specificity: [0, 0, 0], selector: stringified })
        }
        break;

      // ... and pseudo-elements in the selector (= C)
      case 'PseudoElementSelector':
        C++;
        parts.push({ specificity: [0, 0, 1], selector: stringified })
        break;
    }
  });

  return {
    specificityArray: [A, B, C],
    specificity: [A, B, C].join(','),
    parts,
  };
};

export {
  specificity
}