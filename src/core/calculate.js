import {
    parse_selector,
    NODE_SELECTOR,
    NODE_SELECTOR_ID,
    NODE_SELECTOR_CLASS,
    NODE_SELECTOR_ATTRIBUTE,
    NODE_SELECTOR_PSEUDO_CLASS,
    NODE_SELECTOR_PSEUDO_ELEMENT,
    NODE_SELECTOR_TYPE,
    NODE_SELECTOR_LIST,
    NODE_SELECTOR_COMBINATOR,
    NODE_SELECTOR_NTH_OF,
} from '@projectwallace/css-parser';
import Specificity from '../index.js';
import { max } from './../util/index.js';

/** @param {import('@projectwallace/css-parser').CSSNode} selectorAST */
const calculateForAST = (selectorAST) => {
    if (!selectorAST || selectorAST.type !== NODE_SELECTOR_LIST) {
        throw new TypeError(`Passed in source is not a Selector AST`);
    }

    // The selector list should contain a single NODE_SELECTOR (type 5)
    // which contains the actual selector parts
    const selectorNode = selectorAST.first_child;
    if (!selectorNode || selectorNode.type !== NODE_SELECTOR) {
        throw new TypeError(`Expected NODE_SELECTOR as first child of SelectorList`);
    }

    // https://www.w3.org/TR/selectors-4/#specificity-rules
    let a = 0; /* ID Selectors */
    let b = 0; /* Class selectors, Attributes selectors, and Pseudo-classes */
    let c = 0; /* Type selectors and Pseudo-elements */

    // Iterate through all parts of the selector (children of NODE_SELECTOR)
    let current = selectorNode.first_child;
    while (current) {
        switch (current.type) {
            case NODE_SELECTOR_ID:
                a += 1;
                break;

            case NODE_SELECTOR_ATTRIBUTE:
            case NODE_SELECTOR_CLASS:
                b += 1;
                break;

            case NODE_SELECTOR_PSEUDO_CLASS:
                switch (current.name.toLowerCase()) {
                    // "The specificity of a :where() pseudo-class is replaced by zero."
                    case 'where':
                        // Noop :)
                        break;

                    case '-webkit-any':
                    case 'any':
                        if (current.first_child) {
                            b += 1;
                        }
                        break;

                    // "The specificity of an :is(), :not(), or :has() pseudo-class is replaced by the specificity of the most specific complex selector in its selector list argument."
                    case '-moz-any':
                    case 'is':
                    case 'matches':
                    case 'not':
                    case 'has':
                        if (current.has_children) {
                            // The first child should be a NODE_SELECTOR_LIST
                            const childSelectorList = current.first_child;
                            if (childSelectorList && childSelectorList.type === NODE_SELECTOR_LIST) {
                                // Calculate Specificity for all selectors in the list and get max
                                const max1 = max(...calculate(childSelectorList));

                                // Adjust orig specificity
                                a += max1.a;
                                b += max1.b;
                                c += max1.c;
                            }
                        }

                        break;

                    // "The specificity of an :nth-child() or :nth-last-child() selector is the specificity of the pseudo class itself (counting as one pseudo-class selector) plus the specificity of the most specific complex selector in its selector list argument"
                    case 'nth-child':
                    case 'nth-last-child':
                        b += 1;

                        if (current.has_children) {
                            // Get NODE_SELECTOR_NTH_OF which contains the "of" selector list
                            const nthOf = current.first_child;
                            if (nthOf && nthOf.type === NODE_SELECTOR_NTH_OF && nthOf.selector) {
                                // Use the convenience property to access the selector list directly
                                const max2 = max(...calculate(nthOf.selector));

                                // Adjust orig specificity
                                a += max2.a;
                                b += max2.b;
                                c += max2.c;
                            }
                        }
                        break;

                    // "The specificity of :host is that of a pseudo-class. The specificity of :host() is that of a pseudo-class, plus the specificity of its argument."
                    // "The specificity of :host-context() is that of a pseudo-class, plus the specificity of its argument."
                    case 'host-context':
                    case 'host':
                        b += 1;

                        if (current.has_children) {
                            // First child is a NODE_SELECTOR_LIST
                            let childSelectorList = current.first_child;
                            if (childSelectorList && childSelectorList.type === NODE_SELECTOR_LIST) {
                                // Get the first selector from the list
                                let childSelector = childSelectorList.first_child;
                                if (childSelector && childSelector.type === NODE_SELECTOR) {
                                    // Build a new selector with only compound selector parts (stop at combinator)
                                    const compoundParts = [];
                                    let selectorPart = childSelector.first_child;

                                    while (selectorPart) {
                                        // Stop if we hit a combinator
                                        if (selectorPart.type === NODE_SELECTOR_COMBINATOR) {
                                            break;
                                        }
                                        compoundParts.push(selectorPart);
                                        selectorPart = selectorPart.next_sibling;
                                    }

                                    if (compoundParts.length > 0) {
                                        // Create a synthetic AST with the compound parts
                                        const syntheticAST = createCompoundSelectorAST(compoundParts);
                                        const childSpecificity = calculateForAST(syntheticAST);

                                        // Adjust orig specificity
                                        a += childSpecificity.a;
                                        b += childSpecificity.b;
                                        c += childSpecificity.c;
                                    }
                                }
                            }
                        }
                        break;

                    // Improper use of Pseudo-Class Selectors instead of a Pseudo-Element
                    // @ref https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements#index
                    case 'after':
                    case 'before':
                    case 'first-letter':
                    case 'first-line':
                        c += 1;
                        break;

                    default:
                        b += 1;
                        break;
                }
                break;

            case NODE_SELECTOR_PSEUDO_ELEMENT:
                switch (current.name) {
                    // "The specificity of ::slotted() is that of a pseudo-element, plus the specificity of its argument."
                    case 'slotted':
                        c += 1;

                        if (current.has_children) {
                            // First child is a NODE_SELECTOR_LIST
                            let childSelectorList = current.first_child;
                            if (childSelectorList && childSelectorList.type === NODE_SELECTOR_LIST) {
                                // Get the first selector from the list
                                let childSelector = childSelectorList.first_child;
                                if (childSelector && childSelector.type === NODE_SELECTOR) {
                                    // Build a new selector with only compound selector parts (stop at combinator)
                                    const compoundParts = [];
                                    let selectorPart = childSelector.first_child;

                                    while (selectorPart) {
                                        // Stop if we hit a combinator
                                        if (selectorPart.type === NODE_SELECTOR_COMBINATOR) {
                                            break;
                                        }
                                        compoundParts.push(selectorPart);
                                        selectorPart = selectorPart.next_sibling;
                                    }

                                    if (compoundParts.length > 0) {
                                        // Create a synthetic AST with the compound parts
                                        const syntheticAST = createCompoundSelectorAST(compoundParts);
                                        const childSpecificity = calculateForAST(syntheticAST);

                                        // Adjust orig specificity
                                        a += childSpecificity.a;
                                        b += childSpecificity.b;
                                        c += childSpecificity.c;
                                    }
                                }
                            }
                        }
                        break;

                    case 'view-transition-group':
                    case 'view-transition-image-pair':
                    case 'view-transition-old':
                    case 'view-transition-new':
                        // The specificity of a view-transition selector with a * argument is zero.
                        if (current.has_children) {
                            const firstChild = current.first_child;
                            if (firstChild && firstChild.text === '*') {
                                break;
                            }
                        }
                        // The specificity of a view-transition selector with an argument is the same
                        // as for other pseudo - elements, and is equivalent to a type selector.
                        c += 1;
                        break;

                    default:
                        c += 1;
                        break;
                }
                break;

            case NODE_SELECTOR_TYPE:
                // Omit namespace
                let typeSelector = current.name;
                if (typeSelector.includes('|')) {
                    typeSelector = typeSelector.split('|')[1];
                }

                // "Ignore the universal selector"
                if (typeSelector !== '*') {
                    c += 1;
                }
                break;

            default:
                // NOOP
                break;
        }

        current = current.next_sibling;
    }

    return new Specificity({ a, b, c }, selectorAST);
};

const convertToAST = (source) => {
    // The passed in argument was a String.
    // ~> Let's try and parse to an AST
    if (typeof source === 'string' || source instanceof String) {
        try {
            return parse_selector(source);
        } catch (e) {
            throw new TypeError(`Could not convert passed in source '${source}' to SelectorList: ${e.message}`);
        }
    }

    // The passed in argument was an Object.
    // ~> Let's verify if it's a AST of the type NODE_SELECTOR_LIST
    if (source instanceof Object) {
        if (source.type && source.type === NODE_SELECTOR_LIST) {
            return source;
        }

        throw new TypeError(`Passed in source is an Object but no AST / AST of the type SelectorList`);
    }

    throw new TypeError(`Passed in source is not a String nor an Object. I don't know what to do with it.`);
};

/**
 * @param {string|import('@projectwallace/css-parser').CSSNode} selector
 * @returns {Specificity[]}
 */
const calculate = (selector) => {
    // Quit while you're ahead
    if (!selector) {
        return [];
    }

    // Make sure we have a SelectorList AST
    // If not, an exception will be thrown
    const ast = convertToAST(selector);

    // SelectorList - the ast is always a SelectorList
    // Its children are NODE_SELECTOR (type 5) nodes
    // ~> Calculate Specificity for each NODE_SELECTOR
    const specificities = [];
    let selectorNode = ast.first_child;
    while (selectorNode) {
        // Each child should be a NODE_SELECTOR, wrap it in a list for calculateForAST
        specificities.push(calculateForAST(createSelectorListWrapper(selectorNode)));
        selectorNode = selectorNode.next_sibling;
    }
    return specificities;
};

// Helper to wrap a single NODE_SELECTOR in a NODE_SELECTOR_LIST for calculateForAST
function createSelectorListWrapper(selectorNode) {
    // Create a pseudo selector list that acts like it contains just this one selector
    // Include the text property so selectorString() works correctly
    return {
        type: NODE_SELECTOR_LIST,
        first_child: selectorNode,
        next_sibling: null,
        has_children: true,
        text: selectorNode.text || '',
    };
}

// Helper to create a synthetic AST from compound selector parts
function createCompoundSelectorAST(compoundParts) {
    if (compoundParts.length === 0) {
        throw new Error('Cannot create compound selector AST from empty parts array');
    }

    // Clone the parts using built-in clone() method (available in css-parser@0.6.7+)
    const clonedParts = compoundParts.map(part => part.clone());

    // Link them together with next_sibling
    for (let i = 0; i < clonedParts.length - 1; i++) {
        clonedParts[i].next_sibling = clonedParts[i + 1];
    }

    // Create NODE_SELECTOR containing the parts
    const selectorNode = {
        type: NODE_SELECTOR,
        first_child: clonedParts[0],
        next_sibling: null,
        has_children: true,
        text: compoundParts.map((n) => n.text).join(''),
    };

    // Wrap in NODE_SELECTOR_LIST
    return {
        type: NODE_SELECTOR_LIST,
        first_child: selectorNode,
        next_sibling: null,
        has_children: true,
        text: selectorNode.text,
    };
}

export { calculate, calculateForAST };
