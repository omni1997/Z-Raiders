// logger.js — utilise DEBUG=true node server.js pour activer les logs debug
const IS_DEBUG = process.env.DEBUG === 'true';

const logger = {
  info:  (...args) => console.log('[INFO] ', ...args),
  warn:  (...args) => console.warn('[WARN] ', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => { if (IS_DEBUG) console.log('[DEBUG]', ...args); },
};

module.exports = logger;
