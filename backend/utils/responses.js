const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS,DELETE,PUT,PATCH',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-user-id',
  'Content-Type': 'application/json',
};

module.exports = { corsHeaders };
