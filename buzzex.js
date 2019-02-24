const got    = require('got');
const crypto = require('crypto');
const qs     = require('qs');
const request = require('request');

// Public/Private method names
const methods = {
  public  : [ 'info', 'ticker', 'depth', 'trades' ],
  private : [ 'getinfo', 'trade', 'active-orders', 'order-info', 'cancel-order'],
};

// Default options
const defaults = {
  url     : 'https://api.buzzex.io',
  version : 0,
  timeout : 5000,
};

// Create a signature for a request
const getMessageSignature = (path, request, secret, nonce) => {
  const message       = qs.stringify(request);
  const secret_buffer = new Buffer(secret, 'base64');
  const hash          = new crypto.createHash('sha256');
  const hmac          = new crypto.createHmac('sha512', secret_buffer);
  const hash_digest   = hash.update(nonce + message).digest('binary');
  const hmac_digest   = hmac.update(path + hash_digest, 'binary').digest('base64');

  return hmac_digest;
};

// Send an API request
const rawRequest = async (url, headers, data, timeout, method) => {
  // Set custom User-Agent string
  headers['User-Agent'] = 'Buzzex Javascript API Client';

  const options = { headers, timeout };

  Object.assign(options, {
    method : method,
    body: qs.stringify(data)
  });

  if(method == "POST"){
    url = url +"?"+ qs.stringify(data);
  }

  console.log(options);
  const { body } = await got(url, options);
  const response = JSON.parse(body);

  if(response.error && response.error.length) {
    const error = response.error
      .filter((e) => e.startsWith('E'))
      .map((e) => e.substr(1));

    if(!error.length) {
      throw new Error("Buzzex API returned an unknown error");
    }
    console.log('error');
    //throw new Error(error.join(', '));
  }

  return response;
};

const getToken = async (key, secret) => {
  // Set custom User-Agent string
  console.log("Getting Token...");
  const response = new Promise(resolve => {
      request({
          url: 'https://api.buzzex.io/api/token',
          method: 'POST',
          json: {
              grant_type: 'client_credentials',
              client_id: key,
              client_secret: secret
          }
      }, function (error, response, body) {
          if(!error){
            console.log(body);
            resolve(body);
          }
          else{
            console.log(error);
          }
      })
  });

  return response;
};

/**
 * KrakenClient connects to the Kraken.com API
 * @param {String}        key               API Key
 * @param {String}        secret            API Secret
 * @param {String|Object} [options={}]      Additional options. If a string is passed, will default to just setting `options.otp`.
 * @param {String}        [options.otp]     Two-factor password (optional) (also, doesn't work)
 * @param {Number}        [options.timeout] Maximum timeout (in milliseconds) for all API-calls (passed to `request`)
 */
class BuzzexClient {
  constructor(key, secret, options) {
    // Allow passing the OTP as the third argument for backwards compatibility
    if(typeof options === 'string') {
      options = { otp : options };
    }

    this.config = Object.assign({ key, secret }, defaults, options);
  }

  /**
   * This method makes a public or private API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  api(method, params, callback) {
    // Default params to empty object

    if(typeof params === 'function') {
      callback = params;
      params   = {};
    }

    if(methods.public.includes(method)) {
      return this.publicMethod(method, params, callback);
    }
    else if(methods.private.includes(method)) {
      return this.privateMethod(method, params, callback);
    }
    else {
      throw new Error(method + ' is not a valid API method.');
    }
  }

  /**
   * This method makes a public API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  publicMethod(method, params, callback) {
    params = params || {};

    // Default params to empty object
    if(typeof params === 'function') {
      callback = params;
      params   = {};
    }

    const path     = '/api/v1/' + method;
    const url      = this.config.url + path + '/'+params.param;
    
    console.log("-Public-");
    console.log(url);

    const response = rawRequest(url, {}, params, this.config.timeout, 'GET');

    if(typeof callback === 'function') {
      response
        .then((result) => callback(null, result))
        .catch((error) => callback(error, null));
    }

    return response;
  }

  /**
   * This method makes a private API request.
   * @param  {String}   method   The API method (public or private)
   * @param  {Object}   params   Arguments to pass to the api call
   * @param  {Function} callback A callback function to be executed when the request is complete
   * @return {Object}            The request object
   */
  privateMethod(method, params, callback) {
    params = params || {};

    // Default params to empty object
    if(typeof params === 'function') {
      callback = params;
      params   = {};
    }

    if(params.param === undefined) {
      params.param = "";
    }else{

      if(method != "trade"){
        params.param = '/'+params.param;
      }

    }

    const path     = '/api/v1/trading/' + method;
    const url      = this.config.url + path + params.param;
    var header_method = "GET";

    console.log("-Private-");

    if(!params.nonce) {
      params.nonce = new Date() * 1000; // spoof microsecond
    }

    if(this.config.otp !== undefined) {
      params.otp = this.config.otp;
    }

    const signature = getMessageSignature(
      path,
      params,
      this.config.secret,
      params.nonce
    );

    const token = getToken(this.config.key,this.config.secret);

    token.then(value => {
      const headers = {
        'Authorization'  : "Bearer "+value.access_token,
      };

      if(method == "trade"){
        header_method = "POST";
      }

      console.log(url);
      const response = rawRequest(url, headers, params, this.config.timeout, header_method);

      if(typeof callback === 'function') {
        response
          .then((result) => callback(null, result))
          .catch((error) => callback(error, null));
      }

      return response;
    });
  }
}

module.exports = BuzzexClient;
