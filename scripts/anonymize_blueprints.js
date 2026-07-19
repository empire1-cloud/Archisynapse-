const crypto = require('crypto');
const fs = require('fs');

function hush(s) {
  if (!s) return null;
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0,16);
}

function anonymizeBlueprint(bp) {
  const out = JSON.parse(JSON.stringify(bp));
  if (out.merchant_id) out.merchant_id = hush(out.merchant_id);
  if (out.components && Array.isArray(out.components)) {
    out.components = out.components.map(c => {
      const nc = { ...c };
      delete nc.owner_email;
      delete nc.callback_url;
      if (nc.metadata) delete nc.metadata.customer_email;
      return nc;
    });
  }
  return out;
}

if (require.main === module) {
  const infile = process.argv[2];
  const outfile = process.argv[3] || 'anonymized_blueprints.json';
  if (!infile) {
    console.error('Usage: node scripts/anonymize_blueprints.js <input.json> [output.json]');
    process.exit(2);
  }
  const content = fs.readFileSync(infile, 'utf8');
  const arr = JSON.parse(content);
  const anonymized = arr.map(anonymizeBlueprint);
  fs.writeFileSync(outfile, JSON.stringify(anonymized, null, 2));
  console.log('Wrote', outfile);
}

module.exports = { anonymizeBlueprint, hush };
