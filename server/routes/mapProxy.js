const express = require('express');
const axios = require('axios');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const WMS_URL = 'https://api.vworld.kr/req/wms';

// 브라우저는 이 엔드포인트만 호출하고, V-World 인증키는 서버에서만 붙여 전달한다
// (키가 프론트로 노출되지 않도록).
router.get(
  '/wms',
  asyncHandler(async (req, res) => {
    const response = await axios.get(WMS_URL, {
      params: { ...req.query, key: env.vworldApiKey, domain: env.vworldDomain },
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    res.set('Content-Type', response.headers['content-type'] || 'image/png');
    res.send(response.data);
  })
);

module.exports = router;
