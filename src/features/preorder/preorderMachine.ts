import { setup } from 'xstate';

type Events =
  | { type: 'REVIEW' }
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
        REVIEW: 'reviewing'
      }
    },
    reviewing: {
      on: {
        KEEP_SHOPPING: 'selecting'
      }
    }
  }
});
