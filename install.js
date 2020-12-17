const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');

const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const scopes = 'read_products';
const forwardingAddress = "https://7ea9989b1d35.ngrok.io";

module.exports = {

    install: function (req, res) {
        const shop = req.query.shop;
        if (shop) {
            const state = nonce();
            const redirectUri = `${forwardingAddress}/shopify/callback`;
            const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&state=${state}&redirect_uri=${redirectUri}`;

            res.cookie('state', state);
            res.redirect(installUrl);
        } else {
            return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
        }
    },

    callback: function (req, res) {
        const { shop, hmac, code, state } = req.query;
        const stateCookie = cookie.parse(req.headers.cookie).state;

        if (state !== stateCookie) {
            return res.status(403).send('Request origin cannot be verified');
        }

        if (shop && hmac && code) {
            const map = Object.assign({}, req.query);
            delete map['signature'];
            delete map['hmac'];
            const message = querystring.stringify(map);
            const providedHmac = Buffer.from(hmac, 'utf-8');
            const generatedHash = Buffer.from(
                crypto
                    .createHmac('sha256', apiSecret)
                    .update(message)
                    .digest('hex'),
                'utf-8'
            );
            let hashEquals = false;
            // timingSafeEqual will prevent any timing attacks. Arguments must be buffers
            try {
                hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac);
                // timingSafeEqual will return an error if the input buffers are not the same length.
            } catch (e) {
                hashEquals = false;
            };

            if (!hashEquals) {
                return res.status(400).send('HMAC validation failed');
            }

            const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
            const accessTokenPayload = {
                client_id: apiKey,
                client_secret: apiSecret,
                code,
            };

            request.post(accessTokenRequestUrl, { json: accessTokenPayload })
                .then((accessTokenResponse) => {
                    const accessToken = accessTokenResponse.access_token;

                    const shopRequestUrl = `https://${shop}/admin/api/2020-10/products.json`;
                    const shopRequestHeaders = {
                        'X-Shopify-Access-Token': accessToken,

                    };
                    request.get(shopRequestUrl, { headers: shopRequestHeaders })
                        .then((shopResponse) => {
                            let obj = JSON.parse(shopResponse);

                            return res.redirect('/shopify/product');
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
    }




}
