const axios = require('axios');
const { Errors } = require('../utils/errors');

const client = axios.create({ timeout: 8000 });

async function request(source, config) {
  try {
    const res = await client.request(config);
    return res.data;
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      throw Errors.upstreamTimeout(source);
    }
    const status = err.response && err.response.status;
    if (status === 401 || status === 403) {
      throw Errors.upstreamAuthError(source);
    }
    if (status === 429) {
      throw Errors.upstreamRateLimit(source);
    }
    throw Errors.upstreamError(source, err.message);
  }
}

module.exports = { request };
