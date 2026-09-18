const express = require('express');
const env = require('../config/env');

const router = express.Router();

// 브라우저에서 필요한, 노출되어도 되는 설정값만 전달한다(비밀키 아님 — 도메인 제한형 키).
router.get('/', (req, res) => {
  res.json({ naverMapClientId: env.naverMapClientId });
});

module.exports = router;
