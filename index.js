import csstree from 'css-tree'
import { specificity } from './specificity.js'

/** @typedef {[number, number, number]} Specificity */

/**
 * @param {Specificity|String} A
 * @param {Specificity|String} B
 * @returns {number} order - 0 if A == B; -1 if B > A; 1 if A > B
 */
function compare(a, b) {
  if (typeof a === 'string') {
    a = calculate(a).specificityArray
  }
  if (typeof b === 'string') {
    b = calculate(b).specificityArray
  }

  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }

  return 0
}

/**
 * Calculate the specificity of a selector
 * @param {string} selector
 */
const calculate = (selector) => {
  const ast = csstree.parse(selector, {
    context: 'selector',
    positions: true
  })

  function stringifyNode(node) {
    if (!node.loc) return
    return selector.substring(
      node.loc.start.column - 1,
      node.loc.end.column - 1
    )
  }

  return {
    ...specificity(ast, stringifyNode),
    selector
  }
}

export {
  calculate,
  compare
}