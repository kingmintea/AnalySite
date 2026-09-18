/* global ol */

const view = new ol.View({ center: ol.proj.fromLonLat([127.0, 37.55]), zoom: 11 });

const baseLayer = new ol.layer.Tile({ source: new ol.source.OSM() });

function wmsLayer(layerName) {
  return new ol.layer.Tile({
    source: new ol.source.TileWMS({
      url: '/api/map/wms',
      params: {
        SERVICE: 'WMS',
        REQUEST: 'GetMap',
        VERSION: '1.3.0',
        LAYERS: layerName,
        FORMAT: 'image/png',
        TRANSPARENT: true,
        CRS: 'EPSG:3857',
      },
      serverType: 'geoserver',
    }),
    opacity: 0.6,
  });
}

const landUseLayers = ['lt_c_uq111', 'lt_c_uq112', 'lt_c_uq113', 'lt_c_uq114'].map(wmsLayer);
const cadastreLayer = wmsLayer('lp_pa_cbnd_bubun');

const markerSource = new ol.source.Vector();
const markerLayer = new ol.layer.Vector({ source: markerSource });

const map = new ol.Map({
  target: 'map',
  view,
  layers: [baseLayer, ...landUseLayers, cadastreLayer, markerLayer],
});

export function moveTo(x, y) {
  const coord = ol.proj.fromLonLat([x, y]);
  markerSource.clear();
  markerSource.addFeature(new ol.Feature({ geometry: new ol.geom.Point(coord) }));
  view.animate({ center: coord, zoom: 18, duration: 400 });
}

export function setLandUseVisible(visible) {
  landUseLayers.forEach((layer) => layer.setVisible(visible));
}

export function setCadastreVisible(visible) {
  cadastreLayer.setVisible(visible);
}

// 결과 뷰가 hidden 상태에서 벗어나 처음 보일 때 OpenLayers가 컨테이너 크기를
// 다시 계산하도록 호출한다(hidden 상태에서는 크기가 0으로 측정됨).
export function updateSize() {
  map.updateSize();
}
