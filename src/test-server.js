const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Hello'));
const server = app.listen(3002, () => {
  console.log('Test server listening on 3002');
});
