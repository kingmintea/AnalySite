const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const geocodeRoute = require('./routes/geocode');
const pnuRoute = require('./routes/pnu');
const landUseRoute = require('./routes/landUse');
const landPriceRoute = require('./routes/landPrice');
const parcelInfoRoute = require('./routes/parcelInfo');
const mapProxyRoute = require('./routes/mapProxy');
const configRoute = require('./routes/config');
const weatherRoute = require('./routes/weather');
const climateNormalsRoute = require('./routes/climateNormals');
const nearbyPlacesRoute = require('./routes/nearbyPlaces');
const addressSearchRoute = require('./routes/addressSearch');

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/geocode', geocodeRoute);
app.use('/api/pnu', pnuRoute);
app.use('/api/land-use', landUseRoute);
app.use('/api/land-price', landPriceRoute);
app.use('/api/parcel-info', parcelInfoRoute);
app.use('/api/map', mapProxyRoute);
app.use('/api/config', configRoute);
app.use('/api/weather', weatherRoute);
app.use('/api/climate-normals', climateNormalsRoute);
app.use('/api/nearby-places', nearbyPlacesRoute);
app.use('/api/address-search', addressSearchRoute);

app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: '요청한 경로를 찾을 수 없습니다.' } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  if (statusCode >= 500) {
    console.error(err);
  }
  res.status(statusCode).json({ error: { code, message: err.message || '알 수 없는 오류가 발생했습니다.' } });
});

app.listen(env.port, () => {
  console.log(`AnalySite server listening on http://localhost:${env.port} (mock mode: ${env.useMock})`);
});
