const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const naverLocalSearch = require('../services/naverLocalSearch');
const mockPlaces = require('../mock/sampleNearbyPlaces.json');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { x, y } = req.query;
    if (!x || !y || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) {
      throw Errors.invalidRequest('x, y 좌표 파라미터가 필요합니다.');
    }

    if (!env.naverSearchClientId || !env.naverSearchClientSecret) {
      res.set('X-Data-Source', 'mock');
      return res.json(mockPlaces);
    }

    res.set('X-Data-Source', 'naver-local-search');
    const categories = req.query.categories
      ? String(req.query.categories).split(',').map((c) => c.trim()).filter(Boolean)
      : naverLocalSearch.DEFAULT_CATEGORIES;

    const areaHint = req.query.address ? String(req.query.address) : undefined;
    const places = await naverLocalSearch.getNearbyPlaces(Number(x), Number(y), categories, areaHint);
    res.json(places);
  })
);

module.exports = router;
