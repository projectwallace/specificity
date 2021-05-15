import { suite } from 'uvu'
import * as assert from 'uvu/assert'
import { compare } from './index.js'

const Compare = suite('Compare')

Compare('compares two Specificities', () => {
  assert.is(compare([0, 0, 1], [1, 0, 0]), -1)
  assert.is(compare([0, 0, 1], [0, 0, 1]), 0)
  assert.is(compare([1, 1, 0], [1, 0, 0]), 1)
})

Compare('compares two strings', () => {
  assert.is(compare('testElement', '.testClassName'), -1)
  assert.is(compare('.testClassName', '.testClassName'), 0)
  assert.is(compare('#testId', '.testClassName'), 1)
})

Compare('compares a mix of string and Specificity', () => {
  assert.is(compare('testElement', [0, 1, 0]), -1)
  assert.is(compare([0, 1, 0], '.testClassName'), 0)
  assert.is(compare('#testId', [0, 0, 1]), 1)
})

Compare.run()