const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../backend/local_server.js');
let code = fs.readFileSync(filePath, 'utf8');

const newRoutes = `
app.post('/duet/open', async (req, res) => {
  const result = await lambda.openDuet(createMockEvent(req));
  res.status(result.statusCode).json(JSON.parse(result.body));
});

app.get('/duets/open', async (req, res) => {
  const result = await lambda.getOpenDuets(createMockEvent(req));
  res.status(result.statusCode).json(JSON.parse(result.body));
});

app.post('/duet/join', async (req, res) => {
  const result = await lambda.joinDuet(createMockEvent(req));
  res.status(result.statusCode).json(JSON.parse(result.body));
});
`;

code = code.replace("app.listen(port", newRoutes + "\napp.listen(port");
fs.writeFileSync(filePath, code);
console.log('Routes added to local_server.js');
