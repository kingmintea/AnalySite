class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const Errors = {
  addressNotFound: () =>
    new AppError(404, 'ADDRESS_NOT_FOUND', '입력한 주소로 좌표를 찾을 수 없습니다.'),

  parcelNotFound: () =>
    new AppError(404, 'PARCEL_NOT_FOUND', '해당 좌표에서 필지 정보를 찾을 수 없습니다.'),
  
  invalidRequest: (message) => new AppError(400, 'INVALID_REQUEST', message),

  upstreamAuthError: (source) =>
    new AppError(502, 'UPSTREAM_AUTH_ERROR', `${source} API 인증에 실패했습니다. API 키를 확인하세요.`),

  upstreamRateLimit: (source) =>
    new AppError(429, 'UPSTREAM_RATE_LIMIT', `${source} API 요청 한도를 초과했습니다.`),

  upstreamTimeout: (source) =>
    new AppError(504, 'UPSTREAM_TIMEOUT', `${source} API 응답이 지연되고 있습니다.`),

  upstreamError: (source, message) =>
    new AppError(502, 'UPSTREAM_ERROR', message || `${source} API 호출 중 오류가 발생했습니다.`),
};

module.exports = { AppError, Errors };
