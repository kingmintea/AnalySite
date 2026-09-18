const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const kmaWeather = require('../services/kmaWeather');
const mockWeather = require('../mock/sampleWeather.json');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { x, y } = req.query;
    if (!x || !y || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) {
      throw Errors.invalidRequest('x, y 좌표 파라미터가 필요합니다.');
    }

    if (!env.dataGoKrWeatherKey) {
      res.set('X-Data-Source', 'mock');
      return res.json(mockWeather);
    }

    const lon = Number(x);
    const lat = Number(y);
    try {
      const [current, national] = await Promise.all([
        kmaWeather.getCurrentWeather(lat, lon),
        kmaWeather.getNationalComparison(),
      ]);

      res.set('X-Data-Source', 'kma');
      res.json({ ...current, national });
    } catch (error) {
      // 키 만료·권한 오류·일시적 장애가 있어도 기후 탭은 목업으로 렌더링한다.
      console.warn(`[weather] 실시간 API 실패, 목업으로 대체: ${error.message}`);
      res.set('X-Data-Source', 'mock-fallback');
      res.json(mockWeather);
    }
  })
);

module.exports = router;
