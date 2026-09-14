// ============================================================================
// AWS LAMBDA FUNCTIONS (PROXY ROUTER)
// This file acts purely as a router, redirecting all AWS requests to the 
// modular handlers in the /handlers directory.
// ============================================================================

const songs = require('./handlers/songs');
const schedule = require('./handlers/schedule');
const users = require('./handlers/users');
const karaoke = require('./handlers/karaoke');
const admin = require('./handlers/admin');
const social = require('./handlers/social');
const suggestions = require('./handlers/suggestions');
const health = require('./handlers/health');

module.exports = {
  ...songs,
  ...schedule,
  ...users,
  ...karaoke,
  ...admin,
  ...social,
  ...suggestions,
  ...health
};
