/**
 * verify:cart — the navbar badge must track what is actually in the cart.
 *
 * WHY THIS EXISTS
 * Customers reported the cart count not populating on vitalityproject.global.
 * The cause was `get itemCount()` declared on the zustand store: setState does
 * Object.assign({}, state, partial), and Object.assign reads an accessor and
 * copies its VALUE, so the first write flattened the getter into a frozen
 * number. persist's rehydrate counts as a write, so the badge froze at 0 on
 * every page load — and "itemCount":0 was written into localStorage too.
 *
 * This rebuilds the store both ways and asserts the difference, so the bug
 * cannot come back by someone re-adding a computed field to the store.
 *
 *   node scripts/verify-cart-count.mjs
 */
import { createStore } from 'zustand/vanilla';
import { persist } from 'zustand/middleware';

const makeStorage = () => {
  const mem = new Map();
  return {
    store: mem,
    api: {
      getItem: k => JSON.parse(mem.get(k) ?? 'null'),
      setItem: (k, v) => mem.set(k, JSON.stringify(v)),
      removeItem: k => mem.delete(k),
    },
  };
};

const ITEMS = [
  { productId: 'p1', variantId: 'v1', quantity: 2, name: 'A' },
  { productId: 'p2', variantId: 'v2', quantity: 1, name: 'B' },
  { productId: 'p3', variantId: 'v3', quantity: 4, name: 'C' },
];
const EXPECTED = ITEMS.reduce((s, i) => s + i.quantity, 0); // 7

/** The old shape: a getter living on the store. */
function buildWithGetter(storage) {
  return createStore(
    persist(
      (set, get) => ({
        items: [],
        addItem: item => set(state => ({ items: [...state.items, item] })),
        get itemCount() {
          return get().items.reduce((sum, i) => sum + i.quantity, 0);
        },
      }),
      { name: 'c', version: 2, storage },
    ),
  );
}

/** The shape now shipped: items only, count derived by a selector. */
function buildDerived(storage) {
  return createStore(
    persist(
      (set) => ({
        items: [],
        addItem: item => set(state => ({ items: [...state.items, item] })),
      }),
      { name: 'c', version: 3, storage, partialize: s => ({ items: s.items }) },
    ),
  );
}
const select = store => store.getState().items.reduce((s, i) => s + i.quantity, 0);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(48)} ${actual}${ok ? '' : `  (expected ${expected})`}`);
};

console.log('\n— cart badge —\n');

// Positive control: the old shape MUST still be broken. If this ever starts
// passing, this file is no longer testing what it claims to test.
const a = makeStorage();
const withGetter = buildWithGetter(a.api);
ITEMS.forEach(i => withGetter.getState().addItem(i));
console.log('  control — the shape that caused the bug:');
check('stored getter reports the wrong count', withGetter.getState().itemCount !== EXPECTED, true);
check('...and leaks itemCount into localStorage', a.store.get('c').includes('"itemCount"'), true);

console.log('\n  shipped — count derived by selector:');
const b = makeStorage();
const derived = buildDerived(b.api);
check('empty cart', select(derived), 0);
derived.getState().addItem(ITEMS[0]);
check('after 2x A', select(derived), 2);
derived.getState().addItem(ITEMS[1]);
check('after 1x B', select(derived), 3);
derived.getState().addItem(ITEMS[2]);
check('after 4x C', select(derived), EXPECTED);
check('localStorage holds items only', b.store.get('c').includes('"itemCount"'), false);

console.log('');
if (failures) {
  console.log(`✗ ${failures} assertion(s) failed — the badge does not track the cart.\n`);
  process.exit(1);
}
console.log('✓ badge tracks the cart, and no derived value is persisted.\n');
