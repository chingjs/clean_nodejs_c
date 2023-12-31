require('dotenv').config();
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const serverPrivateKey = fs.readFileSync(
  path.join(__dirname, '..', '..', 'credentials', 'privKey.pem'),
  'utf-8'
);
let rmToken = {};
let loopCount = {};

function generateNonce() {
  let text = '';
  const possible = '0123456789abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < 32; i++) {
    text += possible[Math.floor(Math.random() * possible.length)];
  }
  return text;
}

function randomId() {
  let text = '';
  const possible = '0123456789';
  for (let i = 0; i < 16; i++) {
    text += possible[Math.floor(Math.random() * possible.length)];
  }
  return text;
}
// REQUEST TOKEN //
const requestToken = (outlet, callback) => {
  const { rmClientId, rmClientSecret, outletId } = outlet;

  const encoded = Buffer.from(`${rmClientId}:${rmClientSecret}`).toString(
    'base64'
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encoded}`,
  };
  const body = JSON.stringify({ grantType: 'client_credentials' });

  fetch(process.env.RM_TOKEN_URL, {
    method: 'post',
    headers,
    body,
  })
    .then((res) => res.json())
    .then((jsonRes) => {
      if (jsonRes.error) {
        console.log('Error when request token : \n', jsonRes.error);
        callback(jsonRes.error);
      } else {
        if (!rmToken[outletId]) {
          rmToken[outletId] = {};
        }
        rmToken[outletId].accessToken = jsonRes.accessToken;
        rmToken[outletId].tokenType = jsonRes.tokenType;
        rmToken[outletId].expiresIn = jsonRes.expiresIn;
        rmToken[outletId].refreshToken = jsonRes.refreshToken;
        rmToken[outletId].refreshTokenExpiresIn = jsonRes.refreshTokenExpiresIn;
        callback(null);
      }
    })
    .catch((err) =>
      console.error('Error when requesting revenue monster token : \n', err)
    );
};
// REFRESH TOKEN
const refreshToken = (outlet, callback) => {
  const { outletId, rmClientId, rmClientSecret } = outlet;
  if (rmToken[outletId]) {
    const encoded = Buffer.from(`${rmClientId}:${rmClientSecret}`).toString(
      'base64'
    );
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${encoded}`,
    };
    const body = JSON.stringify({
      grantType: 'refresh_token',
      refreshToken: rmToken[outletId].refreshToken,
    });

    fetch(process.env.RM_TOKEN_URL, {
      method: 'post',
      headers,
      body,
    })
      .then((res) => res.json())
      .then((jsonRes) => {
        if (jsonRes.error) {
          console.error('Error when refresh token : \n', jsonRes.error);
          callback(jsonRes.error);
        } else {
          rmToken[outletId].accessToken = jsonRes.accessToken;
          rmToken[outletId].tokenType = jsonRes.tokenType;
          rmToken[outletId].expiresIn = jsonRes.expiresIn;
          rmToken[outletId].refreshToken = jsonRes.refreshToken;
          rmToken[outletId].refreshTokenExpiresIn =
            jsonRes.refreshTokenExpiresIn;
          callback(null);
        }
      })
      .catch((err) =>
        console.error('Error when refreshing revenue monster token : \n', err)
      );
  }
};
// GET SIGNATURE
const getSignature = (data, timestamp, nonceStr, callback) => {
  const privateKey = serverPrivateKey
    .replace(/\\n/gi, '\n')
    .replace(/\\r/gi, '');
  const headers = { 'Content-Type': 'application/json' };

  const body = {
    data,
    method: 'post',
    nonceStr,
    requestUrl: process.env.RM_PAYMENT_URL,
    signType: 'sha256',
    timestamp,
    privateKey,
  };

  fetch(process.env.RM_GENSIGN, {
    method: 'post',
    headers,
    body: JSON.stringify(body),
  })
    .then((res) => res.json())
    .then((jsonRes) => callback(jsonRes))
    .catch((err) =>
      console.error(
        'Error when getting signature from revenue monster : \n',
        err
      )
    );
};

// GET PAYMENT URL
const getPaymentUrl = (outlet, param, callback) => {
  const { outletId } = outlet;
  const { title, detail, additionalData, payAmount } = param;

  if (!rmToken[outletId]) {
    requestToken(outlet, (err) => {
      if (err) {
        console.error('Error after request token : \n', err);
        return callback(err, null);
      }
      getPaymentUrl(outlet, param, callback);
    });
  } else {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = generateNonce();
    const redirectUrl = process.env.REDIRECT_URL;
    const notifyUrl = process.env.NOTIFY_URL;
    let body = {
      layoutVersion: 'v3',
      method: [],
      notifyUrl: `${notifyUrl}/api/order/details/updatePayment`,
      order: {
        additionalData,
        amount: payAmount,
        currencyType: 'MYR',
        detail,
        id: randomId(),
        title,
      },
      redirectUrl: `${redirectUrl}/customer/myorder`,
      storeId: outlet.rmStoreId,
      type: 'WEB_PAYMENT',
    };

    getSignature(body, timestamp, nonceStr, (resp) => {
      if (resp.error) { 
        console.log('Error after getSignature : \n', resp.error);
        return callback(resp.error, null);
      } else {
        const headers = {
          Authorization: `Bearer ${rmToken[outletId].accessToken}`,
          'Content-Type': 'application/json',
          'X-Nonce-Str': nonceStr,
          'X-Signature': resp.signature,
          'X-Timestamp': timestamp,
        };

        fetch(process.env.RM_PAYMENT_URL, {
          method: 'post',
          headers,
          body: JSON.stringify(body),
        })
          .then((res) => res.json())
          .then((jsonRes) => {
            if (jsonRes.error) {
              if (jsonRes.error.code === 'TOKEN_EXPIRED') {
                refreshToken(outlet, (err) => {
                  if (err) {
                    return callback(err, null);
                  }
                  getPaymentUrl(outlet, param, callback);
                });
              } else {
                //error here
                // TOKEN_INVALID > request new token
                console.error('Other Error : ', jsonRes.error);
                // console.log({ outlet, param });
                // ---------------------------------------------
                if (!loopCount[outletId]) {
                  // if don't have count
                  // console.log('Try to request new rm token');
                  loopCount[outletId] = 1;
                  delete rmToken[outletId];
                  requestToken(outlet, (err) => {
                    if (err) {
                      console.error(
                        'Error after request token in loop test : \n',
                        err
                      );
                      return callback(err, null);
                    }
                    getPaymentUrl(outlet, param, callback);
                  });
                } else {
                  if (loopCount[outletId] <= 2) {
                    // if less than 2, continue to loop and try
                    console.log('Loop count: ', loopCount[outletId]);
                    console.log('Try again');
                    loopCount[outletId]++;
                    delete rmToken[outletId];
                    requestToken(outlet, (err) => {
                      if (err) {
                        console.error(
                          'Error after request token in loop test loop : \n',
                          err
                        );
                        return callback(err, null);
                      }
                      getPaymentUrl(outlet, param, callback);
                    });
                  } else {
                    // more than 2 times, error
                    console.log('Already tried 2 times');
                    console.log('Stop process');
                    loopCount[outletId] = 0;
                    delete rmToken[outletId];
                    callback(jsonRes.error, null);
                  }
                }
              }
            } else {
              if (jsonRes.code === 'SUCCESS') {
                callback(null, jsonRes.item);
              }
            }
          })
          .catch((err) =>
            console.error(
              'Error when getting payment url from revenue monster : \n',
              err
            )
          );
      }
    });
  }
};

module.exports = getPaymentUrl;
