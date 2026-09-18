const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const vworldLandUse = require('../services/vworldLandUse');
const mockParcel = require('../mock/sampleParcel.json');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { x, y } = req.query;
    if (!x || !y || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) {
      throw Errors.invalidRequest('x, y 좌표 파라미터가 필요합니다.');
    }

    if (env.useMock) {
      return res.json(mockParcel.landUse);
    }

    const result = await vworldLandUse.getLandUse(Number(x), Number(y));
    res.json(result);
  })
);

module.exports = router;
