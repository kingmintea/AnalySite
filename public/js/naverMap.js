const CONTAINER_ID = 'naverMap';
const PANORAMA_CONTAINER_ID = 'naverPanorama';

let loadPromise = null;
let map = null;
let marker = null;
let panorama = null;
let lastLatLng = null;
let streetLayer = null;
let nearbyMarkers = [];
let nearbyInfoWindow = null;
let trafficLayer = null;

function loadScript(clientId) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // panorama 서브모듈을 함께 로드해야 거리뷰(naver.maps.Panorama)를 쓸 수 있다.
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=panorama`;
    script.onload = () => {
      const maps = window.naver?.maps;
      if (!maps) {
        reject(new Error('네이버 지도 API가 초기화되지 않았습니다.'));
        return;
      }

      if (typeof maps.Panorama === 'function') {
        resolve();
        return;
      }

      const previousCallback = maps.onJSContentLoaded;
      maps.onJSContentLoaded = () => {
        if (typeof previousCallback === 'function') previousCallback();
        if (typeof maps.Panorama === 'function') {
          resolve();
        } else {
          reject(new Error('네이버 지도 파노라마 모듈을 불러오지 못했습니다.'));
        }
      };
    };
    script.onerror = () => reject(new Error('네이버 지도 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
}

async function ensureLoaded() {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const res = await fetch('/api/config');
    const { naverMapClientId } = await res.json();
    if (!naverMapClientId) {
      throw new Error('네이버 지도 클라이언트 ID가 설정되지 않았습니다.');
    }
    await loadScript(naverMapClientId);
  })();

  return loadPromise;
}

function ensureMap(centerLatLng) {
  if (!map) {
    map = new naver.maps.Map(CONTAINER_ID, {
      center: centerLatLng,
      zoom: 16,
    });
    marker = new naver.maps.Marker({ position: centerLatLng, map });
    trafficLayer = new naver.maps.TrafficLayer({ interval: 300000 });
    streetLayer = new naver.maps.StreetLayer();
    naver.maps.Event.addListener(map, 'click', (event) => {
      if (streetLayer.getMap() && panorama) panorama.setPosition(event.coord);
    });
  } else {
    naver.maps.Event.trigger(map, 'resize');
    map.setCenter(centerLatLng);
    marker.setPosition(centerLatLng);
  }
}

// V-World 좌표는 {x: 경도, y: 위도} 순서라 naver.maps.LatLng(위도, 경도)로 뒤집어 전달한다.
export async function showAt(x, y) {
  const container = document.getElementById(CONTAINER_ID);
  try {
    await ensureLoaded();
    const latLng = new naver.maps.LatLng(y, x);
    lastLatLng = latLng;
    ensureMap(latLng);
    container.classList.remove('map-error');
  } catch (err) {
    container.classList.add('map-error');
    container.textContent = err.message;
  }
}

export function setMapType(typeId) {
  if (!map) return;
  const id = naver.maps.MapTypeId[typeId];
  if (id !== undefined) map.setMapTypeId(id);
}

export function setTrafficVisible(visible) {
  if (!map || !trafficLayer) return false;
  if (visible) {
    trafficLayer.setMap(map);
    trafficLayer.startAutoRefresh();
  } else {
    trafficLayer.endAutoRefresh();
    trafficLayer.setMap(null);
  }
  return visible;
}

export function setStreetLayerVisible(visible) {
  if (!map || !streetLayer) return false;
  streetLayer.setMap(visible ? map : null);
  return visible;
}

function placeColor(place) {
  if (place.category === '지하철역' && place.subwayLines?.[0]?.color) return place.subwayLines[0].color;
  if (place.category === '버스정류장') return place.busType === 'village' ? '#54a832' : '#1677c8';
  return {
    편의점: '#f59e0b', 카페: '#8b5e3c', 공원: '#16a34a', 학교: '#7c3aed',
    다이소: '#2563eb', 올리브영: '#e11d48', 헬스장: '#0f766e', 도서관: '#9333ea',
  }[place.category] || '#475467';
}

export function setNearbyMarkers(places = []) {
  nearbyMarkers.forEach((item) => item.setMap(null));
  nearbyMarkers = [];
  if (!map) return;

  if (!nearbyInfoWindow) nearbyInfoWindow = new naver.maps.InfoWindow({ maxWidth: 220 });

  places.forEach((place) => {
    if (!Number.isFinite(Number(place.x)) || !Number.isFinite(Number(place.y))) return;
    const color = placeColor(place);
    const placeMarker = new naver.maps.Marker({
      position: new naver.maps.LatLng(Number(place.y), Number(place.x)),
      map,
      title: place.name,
      icon: {
        content: `<span style="display:block;width:14px;height:14px;border:3px solid #fff;border-radius:50%;background:${color};box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>`,
        anchor: new naver.maps.Point(7, 7),
      },
    });
    naver.maps.Event.addListener(placeMarker, 'click', () => {
      const distance = place.distanceM === null || place.distanceM === undefined ? '' : `<br><small>${place.distanceM}m · 도보 ${Math.max(1, Math.round(place.distanceM / 70))}분</small>`;
      nearbyInfoWindow.setContent(`<div style="padding:8px 10px;line-height:1.4"><strong>${place.name}</strong><br><small>${place.category}</small>${distance}</div>`);
      nearbyInfoWindow.open(map, placeMarker);
    });
    nearbyMarkers.push(placeMarker);
  });
}

// 거리뷰(파노라마)를 열거나, 이미 열려 있으면 현재 위치로 갱신한다.
// 해당 위치에 거리뷰 이미지가 없으면 컨테이너에 안내 문구를 띄운다.
export async function showPanoramaAt(x, y) {
  const container = document.getElementById(PANORAMA_CONTAINER_ID);
  if (!container) return;
  container.classList.remove('map-error');
  container.textContent = '';

  try {
    await ensureLoaded();
    const latLng = new naver.maps.LatLng(y, x);

    if (!panorama) {
      panorama = new naver.maps.Panorama(PANORAMA_CONTAINER_ID, { position: latLng });
      naver.maps.Event.addListener(panorama, 'pano_status', (status) => {
        if (status !== naver.maps.PanoramaStatus.OK) {
          container.classList.add('map-error');
          container.textContent = '이 위치는 거리뷰를 제공하지 않습니다.';
        }
      });
    } else {
      panorama.setPosition(latLng);
    }
  } catch (err) {
    container.classList.add('map-error');
    container.textContent = err.message;
  }
}
