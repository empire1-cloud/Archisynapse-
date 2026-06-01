const crypto = require('crypto');

// Generate API Key
const generateApiKey = () => {
  return 'sk_' + crypto.randomBytes(32).toString('hex');
};

// Encrypt sensitive data
const encrypt = (data) => {
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

// Decrypt sensitive data
const decrypt = (encrypted) => {
  const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
};

// Generate transaction ID
const generateTransactionId = () => {
  return 'txn_' + crypto.randomBytes(8).toString('hex');
};

// Hash function for verification
const hash = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

module.exports = {
  generateApiKey,
  encrypt,
  decrypt,
  generateTransactionId,
  hash
};
