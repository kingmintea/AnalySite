const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const vworldParcel = require('../services/vworldParcel');
const mockParcel = require('../mock/sampleParcel.json');

const router = express.Router();

// 개별공시지가는 연속지적도(LP_PA_CBND_BUBUN) 응답에 포함되어 내려오므로
// 별도 API 없이 동일한 조회를 재사용한다.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { x, y } = req.query;
    if (!x || !y || Number.isNaN(Number(x)) || Number.isNaN(Number(y))) {
      throw Errors.invalidRequest('x, y 좌표 파라미터가 필요합니다.');
    }

    if (env.useMock) {
      return res.json(mockParcel.landPrice);
    }

    const result = await vworldParcel.findParcelByCoord(Number(x), Number(y));
    res.json(result.landPrice); // 정보가 없으면 null (정상 케이스)
  })
);

module.exports = router;
