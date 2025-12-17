# @projectwallace/css-parser API Issues

This document describes structural issues in the parser API that make it unnecessarily complex to use compared to similar parsers like css-tree. These issues were discovered while implementing CSS specificity calculation.

## Fixed Issues

- ✅ **Numeric Types Instead of String Types** - Added `node.kind` property that returns string type names for better debugging and readability
- ✅ **Missing Convenience Properties for Pseudo-class Arguments** (Old Issue #2) - Fixed in css-parser@0.6.5: Added `selector` property to NODE_SELECTOR_NTH_OF for direct access to selector list without nested traversal
- ✅ **Cannot Create Synthetic AST Nodes** (Old Issue #2) - Fixed in css-parser@0.6.6: Plain objects matching the AST structure are now accepted as valid AST nodes (though creating them still requires significant boilerplate - see Issue #3)
- ✅ **No Utilities for Cloning or Converting Parser Nodes** (Old Issue #4) - Fixed in css-parser@0.6.7: Added `node.clone()` method to easily clone nodes without manually extracting getter properties

---

## Issue 1: Linked List Requires Manual Traversal

**Severity:** Medium
**Status:** Open

### Problem Description

The parser exposes a linked-list structure with `first_child` and `next_sibling`, but this is an implementation detail that should be hidden behind a more ergonomic API. The `.children` getter exists but isn't consistently the recommended approach.

### Current Behavior

To iterate through selector parts:

```javascript
let current = selector.first_child;
while (current) {
    process(current);
    current = current.next_sibling;  // Manual advancement
}
```

This requires:
- Manual state tracking
- Remembering to advance the pointer
- Can't use array methods (map, filter, find, etc.)
- More verbose and error-prone

### Expected Behavior

Standard iterable pattern:

```javascript
// Using for...of (already supported via Symbol.iterator)
for (const part of selector) {
    process(part);
}

// Or using .children array
selector.children.forEach(part => process(part));
```

### Code Impact

**Current pattern:**
```javascript
// Looking for a specific node type
let nthChild = current.first_child;
while (nthChild) {
    if (nthChild.type === NODE_SELECTOR_NTH_OF) {
        // Found it
        break;
    }
    nthChild = nthChild.next_sibling;
}
```

**Preferred pattern:**
```javascript
const nthChild = current.children.find(n => n.type === NODE_SELECTOR_NTH_OF);
```

### Suggested Fix

1. **Document `.children` as the primary API** - Show it first in examples
2. **Make `.children` always available** - Even for nodes without children, return empty array
3. **Add convenience methods:**
   ```javascript
   node.findChild(type)           // Find first child of type
   node.findChildren(type)        // Find all children of type
   node.hasChildOfType(type)      // Check if child exists
   ```

---

## Issue 2: Compound Selector Extraction Requires Boilerplate

**Severity:** Medium
**Status:** Open

### Problem Description

While css-parser@0.6.6+ allows creating synthetic AST nodes, common operations like extracting compound selectors still require significant boilerplate code. The manual process of cloning nodes, linking them, and wrapping them in the correct structure is complex enough that string reparsing becomes the simpler alternative.

### Current Behavior

To extract a compound selector (parts before first combinator) from `:host(#foo.bar baz)`:

```javascript
// Collect parts before combinator
const compoundParts = [];
let selectorPart = childSelector.first_child;
while (selectorPart) {
    if (selectorPart.type === NODE_SELECTOR_COMBINATOR) break;
    compoundParts.push(selectorPart);
    selectorPart = selectorPart.next_sibling;
}

// Option 1: Reparse string (simpler)
const selectorText = compoundParts.map(n => n.text).join('');
const result = calculate(selectorText);

// Option 2: Create synthetic AST (more complex)
const clonedParts = compoundParts.map(part => part.clone());
for (let i = 0; i < clonedParts.length - 1; i++) {
    clonedParts[i].next_sibling = clonedParts[i + 1];
}
const selectorNode = {
    type: NODE_SELECTOR,
    first_child: clonedParts[0],
    // ... more boilerplate
};
const syntheticAST = {
    type: NODE_SELECTOR_LIST,
    first_child: selectorNode,
    // ... more boilerplate
};
```

**Current implementation uses string reparsing** because the synthetic AST approach requires too much boilerplate.

### Expected Behavior

Built-in helper methods for common operations:

```javascript
// Direct method on selector nodes
const compound = selector.getCompoundSelector();

// Or factory function
import { createSelectorFromParts } from '@projectwallace/css-parser';
const syntheticAST = createSelectorFromParts(compoundParts);

// Or array linking utility
import { linkNodes } from '@projectwallace/css-parser';
const linked = linkNodes(compoundParts.map(p => p.clone()));
```

### Suggested Fix

Add helper methods to the parser:

```javascript
// On NODE_SELECTOR nodes
class SelectorNode {
    /**
     * Get compound selector (parts before first combinator)
     * @returns {SelectorList} Selector list with only compound parts
     */
    getCompoundSelector() {
        const parts = [];
        let current = this.first_child;
        while (current && current.type !== NODE_SELECTOR_COMBINATOR) {
            parts.push(current);
            current = current.next_sibling;
        }
        return createSelectorFromParts(parts);
    }
}

// Factory function
export function createSelectorFromParts(parts) {
    // Handle all the boilerplate of cloning, linking, wrapping
}

// Array linking utility
export function linkNodes(nodes) {
    for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].next_sibling = nodes[i + 1];
    }
    return nodes[0];
}
```

### Benefits

- **Simpler code**: Replace boilerplate with single method call
- **Better performance**: Avoid string reparsing
- **Common patterns**: Makes frequent operations easy
- **Consistency**: Standard API for everyone

---

## Issue 4: Namespace Selectors Not Fully Supported

**Severity:** High
**Status:** ✅ **FIXED** (as of recent version)

### Problem Description

Previously, namespace selectors like `ns|*` and `ns|div` were not parsed correctly. The parser would stop at the `|` character, omitting the rest of the selector.

### Previous Behavior

```javascript
parse_selector('ns|*');
// Returned: NODE_SELECTOR_LIST with text "ns|" (missing the *)
```

### Current Behavior

✅ Now correctly parses namespace selectors with proper structure.

### Verification Needed

Ensure the following all work correctly:
- `ns|*` - Namespace with universal selector
- `ns|div` - Namespace with type selector
- `*|div` - Any namespace with type selector
- `|div` - No namespace (empty namespace)

---

## Issue 5: Missing Convenience Properties

**Severity:** Low
**Status:** Open

### Problem Description

Common queries require verbose code that should be simplified with convenience properties or methods.

### Examples Needed

```javascript
// Check if pseudo-class uses function syntax (has parentheses)
if (node.has_children) { ... }
// Better:
if (node.hasParentheses) { ... }

// Get the name/value for attribute selectors
const attrName = node.name;  // Already good
const attrValue = /* how to get this? */
const attrOperator = node.attr_operator;  // Requires knowing constants

// Check selector specificity contribution
// Currently: Must implement entire specificity algorithm
// Better: node.specificityValue => { a, b, c }

// Check if selector is compound (no combinators)
// Currently: Must iterate and check
// Better: node.isCompound => boolean
```

### Suggested Additions

```javascript
// On all nodes
node.isType(NODE_SELECTOR_TYPE)       // More readable than node.type === NODE_SELECTOR_TYPE
node.nodeTypeName                      // "TypeSelector" instead of number

// On selector nodes
selector.isCompound                    // Has no combinators
selector.specificity                   // { a, b, c } for this selector's contribution

// On pseudo nodes
pseudoClass.hasParentheses            // Uses function syntax
pseudoClass.isEmpty                   // Has () but no content

// On attribute nodes
attribute.name                        // Already exists
attribute.value                       // The attribute value (if any)
attribute.operatorSymbol              // "=", "~=", etc. as string
attribute.isCaseInsensitive          // Boolean for [attr=value i]
```

---

## Implementation Priority

1. **Medium Priority:**
   - Issue 1: Better iteration patterns (can add without breaking)
   - Issue 2: Compound selector helper methods (would eliminate string reparsing)

2. **Low Priority:**
   - Issue 5: Convenience properties (nice-to-have)

## Testing Recommendations

When implementing these fixes:

1. **Add test cases** for all the examples shown in this document
2. **Test with real-world selectors** from major CSS frameworks
3. **Performance test** to ensure convenience methods don't add overhead
4. **Migration guide** for breaking changes with before/after examples

## References

- CSS Selectors Specification: https://www.w3.org/TR/selectors-4/
- css-tree API: https://github.com/csstree/csstree/blob/master/docs/
- This implementation: https://github.com/bramus/specificity
