export const GROUPS = [
  { id: 'claim', label: 'Claim', states: ['idle', 'claim', 'engrave', 'ready'] },
  { id: 'week', label: 'Launch days', states: ['stamp'] },
  { id: 'mirror', label: 'Mirror', states: ['mirror-asking', 'mirror-live', 'mirror-denied'] },
]

export const STATES = {
  idle: { label: 'Idle', on: { CLAIM: 'claim' } },
  claim: { label: 'Name form', on: { SUBMIT: 'engrave', CANCEL: 'idle' } },
  engrave: { label: 'Engraving', on: { DONE: 'ready' } },
  ready: {
    label: 'Ready',
    on: { STAMP: 'stamp', MIRROR: 'mirror-asking', EDIT: 'claim', RESET: 'idle' },
  },
  stamp: { label: 'Stamping a day', on: { DONE: 'ready' } },
  'mirror-asking': {
    label: 'Asking for camera',
    on: { GRANTED: 'mirror-live', DENIED: 'mirror-denied', CANCEL: 'ready' },
  },
  'mirror-live': { label: 'Live reflection', on: { STOP: 'ready' } },
  'mirror-denied': { label: 'Camera blocked', on: { RETRY: 'mirror-asking', CANCEL: 'ready' } },
}

export const next = (state, event) => STATES[state]?.on[event] ?? state
