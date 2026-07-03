exports.up = async function (knex) {
  const client = knex.client.config.client;

  if (client === 'better-sqlite3') {
    await knex.raw(`
      CREATE TRIGGER IF NOT EXISTS trg_ledger_journal_entries_no_update
      BEFORE UPDATE ON ledger_journal_entries
      BEGIN
        SELECT RAISE(ABORT, 'ledger_journal_entries are immutable');
      END;
    `);

    await knex.raw(`
      CREATE TRIGGER IF NOT EXISTS trg_ledger_journal_entries_no_delete
      BEFORE DELETE ON ledger_journal_entries
      BEGIN
        SELECT RAISE(ABORT, 'ledger_journal_entries are immutable');
      END;
    `);
  } else {
    await knex.raw(`
      CREATE OR REPLACE FUNCTION reject_ledger_journal_entry_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'ledger_journal_entries are immutable';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`
      DROP TRIGGER IF EXISTS trg_ledger_journal_entries_no_update ON ledger_journal_entries;
      CREATE TRIGGER trg_ledger_journal_entries_no_update
      BEFORE UPDATE ON ledger_journal_entries
      FOR EACH ROW
      EXECUTE FUNCTION reject_ledger_journal_entry_mutation();
    `);

    await knex.raw(`
      DROP TRIGGER IF EXISTS trg_ledger_journal_entries_no_delete ON ledger_journal_entries;
      CREATE TRIGGER trg_ledger_journal_entries_no_delete
      BEFORE DELETE ON ledger_journal_entries
      FOR EACH ROW
      EXECUTE FUNCTION reject_ledger_journal_entry_mutation();
    `);
  }
};

exports.down = async function (knex) {
  const client = knex.client.config.client;

  if (client === 'better-sqlite3') {
    await knex.raw('DROP TRIGGER IF EXISTS trg_ledger_journal_entries_no_update');
    await knex.raw('DROP TRIGGER IF EXISTS trg_ledger_journal_entries_no_delete');
  } else {
    await knex.raw('DROP TRIGGER IF EXISTS trg_ledger_journal_entries_no_update ON ledger_journal_entries');
    await knex.raw('DROP TRIGGER IF EXISTS trg_ledger_journal_entries_no_delete ON ledger_journal_entries');
    await knex.raw('DROP FUNCTION IF EXISTS reject_ledger_journal_entry_mutation()');
  }
};
