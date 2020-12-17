require('path');
const install = require('./install');
const product = require('../controllers/product.controller');

module.exports = function(app) {

app.get('/shopify',install.install);

app.get('/shopify/callback',install.callback);

app.get('/shopify/product',product.products);

}