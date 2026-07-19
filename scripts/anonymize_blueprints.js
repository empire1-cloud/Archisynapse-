const crypto = require('crypto');
const fs = require('fs');

const SENSITIVE_KEY = /(email|e_mail|ip_address|ip$|phone|mobile|callback|url|uri|token|secret|password|authorization|address)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const URL = /\bhttps?:\/\/[^\s]+/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;

function hush(value, key = process.env.ANONYMIZATION_HMAC_KEY) {
  if (value === undefined || value === null || value === '') return null;
  if (!key) throw new Error('ANONYMIZATION_HMAC_KEY is required');
  return `anon_${crypto.createHmac('sha256', key).update(String(value)).digest('hex').slice(0, 24)}`;
}

function redactString(value) {
  if (EMAIL.test(value) || IPV4.test(value) || URL.test(value) || PHONE.test(value)) {
    return '[REDACTED]';
  }
  return value;
}

function anonymizeValue(value, options) {
  if (Array.isArray(value)) return value.map(item => anonymizeValue(item, options));
  if (typeof value === 'string') return redactString(value);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((clean, [key, item]) => {
    if (key === 'merchant_id' || key === 'merchantId') {
      clean[key] = hush(item, options.key);
    } else if (SENSITIVE_KEY.test(key)) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = anonymizeValue(item, options);
    }
    return clean;
  }, {});
}

function anonymizeBlueprint(blueprint, options = {}) {
  const key = options.key || process.env.ANONYMIZATION_HMAC_KEY;
  return anonymizeValue(blueprint, { key });
}

if (require.main === module) {
  const infile = process.argv[2];
  const outfile = process.argv[3] || 'anonymized_blueprints.json';

  if (!infile) {
    console.error('Usage: ANONYMIZATION_HMAC_KEY=... node scripts/anonymize_blueprints.js <input.json> [output.json]');
    process.exit(2);
  }
  if (!process.env.ANONYMIZATION_HMAC_KEY) {
    console.error('ANONYMIZATION_HMAC_KEY is required');
    process.exit(2);
  }

  const input = JSON.parse(fs.readFileSync(infile, 'utf8'));
  const anonymized = Array.isArray(input)
    ? input.map(blueprint => anonymizeBlueprint(blueprint))
    : anonymizeBlueprint(input);
  fs.writeFileSync(outfile, JSON.stringify(anonymized, null, 2));
  console.log('Wrote', outfile);
}

module.exports = { anonymizeBlueprint, hush };
