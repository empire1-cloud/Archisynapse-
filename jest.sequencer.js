// Custom Jest sequencer: run the ledger integration suite first.
//
// The ledger suite's SQLite trigger assertions are sensitive to
// process-global native state left behind by other DB-backed suites
// (better-sqlite3 is a native addon and is not fully isolated by
// Jest's per-suite module registries). Scheduling the ledger suite
// first guarantees it always runs in a fresh worker process.
const Sequencer = require('@jest/test-sequencer').default;

const FIRST = ['ledger.test.js'];

class LedgerFirstSequencer extends Sequencer {
  sort(tests) {
    const sorted = Array.from(super.sort(tests));
    sorted.sort((a, b) => {
      const aFirst = FIRST.some((f) => a.path.endsWith(f)) ? 0 : 1;
      const bFirst = FIRST.some((f) => b.path.endsWith(f)) ? 0 : 1;
      return aFirst - bFirst;
    });
    return sorted;
  }
}

module.exports = LedgerFirstSequencer;
