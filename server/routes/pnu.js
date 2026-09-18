const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const vworldParcel = require('../services/vworldParcel');
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
      return res.json({ pnu: mockParcel.pnu, area: mockParcel.area, jimok: mockParcel.jimok });
    }

    const result = await vworldParcel.findParcelByCoord(Number(x), Number(y));
    res.json({ pnu: result.pnu, area: result.area, jimok: result.jimok });
  })
);

module.exports = router;
