import { setup } from 'xstate';

type Events =
  | { type: 'DETAILS' }
  | { type: 'REVIEW' }
  | { type: 'EDIT_DETAILS' }
  | { type: 'KEEP_SHOPPING' };

export const preorderMachine = setup({
  types: {
    events: {} as Events
  }
}).createMachine({
  id: 'public-preorder',
  initial: 'selecting',
  states: {
    selecting: {
      on: {
        DETAILS: 'details'
      }
    },
    details: {
      on: {
        REVIEW: 'reviewing',
        KEEP_SHOPPING: 'selecting'
      }
    },
    reviewing: {
      on: {
        EDIT_DETAILS: 'details',
        KEEP_SHOPPING: 'selecting'
      }
    }
  }
});
