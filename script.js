const express = require('express');
const crypto = require('crypto');
const nonce = require('nonce')();
const request = require('request-promise');
const querystring = require('querystring');
const cookie = require('cookie');
let app = express();
 
app.get('/shopify', (req, res) => {
    const shopName = req.query.shop; // Shop Name passed in URL
    if (shopName) {
        const shopState = nonce();
        const redirectUri = process.env.TUNNEL_URL + '/shopify/callback'; // Redirect URI for shopify Callback
        const installUri = 'https://' + shopName +
            '/admin/oauth/authorize?client_id=' + process.env.SHOPIFY_API_KEY +
            '&amp;scope=' + process.env.SCOPES +
            '&amp;state=' + shopState +
            '&amp;redirect_uri=' + redirectUri; // Install URL for app install
 
        res.cookie('state', shopState);
        res.redirect(installUri);
    } else {
        return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
    }
});
 
app.get('/shopify/callback', (req, res) => {
    const {
        shopName,
        hmac,
        code,
        shopState
    } = req.query;
    const stateCookie = cookie.parse(req.headers.cookie).state;
    console.log(shopState + stateCookie);
 
    if (shopState !== stateCookie) {
        return res.status(403).send('Request origin cannot be verified');
    }
 
    if (shopName && hmac && code) {
        const map = Object.assign({}, req.query);
        delete map['signature'];
        delete map['hmac'];
        const message = querystring.stringify(map);
        const providedHmac = Buffer.from(hmac, 'utf-8');
        const generatedHash = Buffer.from(
            crypto
            .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
            .update(message)
            .digest('hex'),
            'utf-8'
        );
        let hashEquals = false;
 
        try {
            hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac)
        } catch (e) {
            hashEquals = false;
        };
 
        if (!hashEquals) {
            return res.status(400).send('HMAC validation failed');
        }
        const accessTokenRequestUrl = 'https://' + shopName + '/admin/oauth/access_token';
        const accessTokenPayload = {
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code,
        };
        request.post(accessTokenRequestUrl, {
                json: accessTokenPayload
            })
            .then((accessTokenResponse) => {
                const accessToken = accessTokenResponse.access_token;
                const shopRequestUrl = 'https://' + shopName + '/admin/api/2019-07/shop.json';
                const shopRequestHeaders = {
                    'X-Shopify-Access-Token': accessToken,
                };
 
                request.get(shopRequestUrl, {
                        headers: shopRequestHeaders
                    })
                    .then((shopResponse) => {
                        res.redirect('https://' + shopName + '/admin/apps');
                    })
                    .catch((error) => {
                        res.status(error.statusCode).send(error.error.error_description);
                    });
            })
            .catch((error) => {
                res.status(error.statusCode).send(error.error.error_description);
            });
 
    } else {
        res.status(400).send('Required parameters missing');
    }
});
 
app.listen(8081, () => {
    console.log('Application  listening');
});
