const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const vworldGeocode = require('../services/vworldGeocode');
const mockParcel = require('../mock/sampleParcel.json');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { address } = req.query;
    if (!address || !address.trim()) {
      throw Errors.invalidRequest('address 파라미터가 필요합니다.');
    }

    if (env.useMock) {
      return res.json({
        x: mockParcel.coord.x,
        y: mockParcel.coord.y,
        roadAddr: mockParcel.address.road,
        parcelAddr: mockParcel.address.parcel,
      });
    }

    const result = await vworldGeocode.geocode(address.trim());
    res.json(result);
  })
);

module.exports = router;
