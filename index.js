import csstree from 'css-tree'
import { specificity } from './specificity.js'

const calculate = (selector) => {
  const ast = csstree.parse(selector, {
    context: 'selector'
  })

  return specificity(ast)
}

export {
  calculate
}