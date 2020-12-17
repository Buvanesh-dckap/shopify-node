let value = require('./install');

module.exports = {
    products: function (req,res) {
        ///res.send('helo');
        res.send(value.obj);    
    }
}