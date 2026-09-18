const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { Errors } = require('../utils/errors');
const jusoAddress = require('../services/jusoAddress');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const keyword = String(req.query.keyword || '').trim();
    if (keyword.length < 2) {
      throw Errors.invalidRequest('주소 검색어를 2글자 이상 입력하세요.');
    }
    res.json(await jusoAddress.search(keyword));
  })
);

module.exports = router;