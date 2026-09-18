const express = require('express');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const vworldGeocode = require('../services/vworldGeocode');
const vworldParcel = require('../services/vworldParcel');
const vworldLandUse = require('../services/vworldLandUse');
const zoningLimits = require('../services/zoningLimits');
const dongLandPrice = require('../services/dongLandPrice');
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
      return res.json(mockParcel);
    }

    const trimmed = address.trim();
    const geo = await vworldGeocode.geocode(trimmed);

    const warnings = [];
    const [parcelResult, landUseResult] = await Promise.allSettled([
      vworldParcel.findParcelByCoord(geo.x, geo.y),
      vworldLandUse.getLandUse(geo.x, geo.y),
    ]);

    if (parcelResult.status === 'rejected') {
      // 면적/지목/공시지가의 근간이 되는 필지 조회 자체가 실패하면 부분 응답이 무의미하므로
      // 여기서는 전체 요청을 실패로 처리한다.
      throw parcelResult.reason;
    }
    if (landUseResult.status === 'rejected') {
      warnings.push(`용도지역/지구 조회 실패: ${landUseResult.reason.message}`);
    }

    const parcel = parcelResult.value;
    const landUse = (landUseResult.status === 'fulfilled' ? landUseResult.value : []).map((item) => ({
      ...item,
      zoningLimit: zoningLimits.getZoningLimit(item.name),
    }));

    let dongLandPriceAvg = null;
    if (parcel.landPrice) {
      try {
        dongLandPriceAvg = await dongLandPrice.getDongAverage(parcel.pnu, parcel.dongName);
      } catch (err) {
        warnings.push(`동 평균 공시지가 조회 실패: ${err.message}`);
      }
    }

    res.json({
      address: { input: trimmed, road: geo.roadAddr, parcel: geo.parcelAddr },
      coord: { x: geo.x, y: geo.y },
      pnu: parcel.pnu,
      area: parcel.area,
      jimok: parcel.jimok,
      landUse,
      landPrice: parcel.landPrice,
      dongLandPriceAvg,
      zoningLegalBasis: zoningLimits.legalBasis,
      zoningDisclaimer: zoningLimits.disclaimer,
      zoningFloorDisclaimer: zoningLimits.floorDisclaimer,
      warnings,
    });
  })
);

module.exports = router;
