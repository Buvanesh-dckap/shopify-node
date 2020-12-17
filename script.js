const dotenv = require('dotenv').config();
const express = require('express');
const app = express();

require('./app/routes/route')(app);

app.listen(8080, () => {
  console.log('Example app listening on ');
});