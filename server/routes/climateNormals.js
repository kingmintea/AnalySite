const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const climateNormals = require('../services/climateNormals');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { x, y } = req.query;
    if (!x || !y || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) {
      throw Errors.invalidRequest('x, y 좌표 파라미터가 필요합니다.');
    }
    res.json(climateNormals.getSeasonalComparison(Number(y), Number(x)));
  })
);

module.exports = router;
