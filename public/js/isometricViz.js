// 대지 면적과 층별 면적을 "대각선 위에서 내려다보는" 등각(isometric) 뷰로 그린다.
// 모양 정확도보다 "층이 쌓이는 느낌"이 목적이라, 모든 박스(대지·각 층)는
// 면적의 제곱근을 한 변으로 하는 정사각형으로 단순화한다.
const ISO_COS = Math.cos(Math.PI / 6); // 30도
const ISO_SIN = Math.sin(Math.PI / 6);
const FLOOR_HEIGHT = 7; // 층 하나의 시각적 높이(모델 단위, 실제 층고 데이터가 없어 균일하게 처리)
const TARGET_MAX_SIDE = 14; // 가장 큰 정사각형 한 변의 모델 단위 크기

function project(x, y, z) {
  return { x: (x - y) * ISO_COS, y: (x + y) * ISO_SIN - z };
}

function pointsAttr(points) {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

// 정사각형 밑변(hw = 한 변/2)을 갖고 zBase~zTop 높이를 갖는 상자의 보이는 3면(윗면/좌측면/우측면).
// 이 투영에서는 카메라 쪽을 향한 두 옆면이 x=+hw, y=+hw 평면이다(둘 다 양수 부호로 맞춰야
// 두 면이 (0,0) 꼭짓점을 공유하며 깔끔히 맞물린다 — x=-hw와 y=+hw처럼 부호를 섞으면
// 두 옆면이 서로 겹쳐버려 왼쪽 면이 제대로 채워지지 않는다).
function boxFaces(hw, zBase, zTop) {
  const top = [project(hw, -hw, zTop), project(hw, hw, zTop), project(-hw, hw, zTop), project(-hw, -hw, zTop)];
  const left = [
    project(-hw, hw, zTop),
    project(hw, hw, zTop),
    project(hw, hw, zBase),
    project(-hw, hw, zBase),
  ];
  const right = [
    project(hw, -hw, zTop),
    project(hw, hw, zTop),
    project(hw, hw, zBase),
    project(hw, -hw, zBase),
  ];
  return { top, left, right };
}

function groundOutline(hw) {
  return [project(-hw, -hw, 0), project(hw, -hw, 0), project(hw, hw, 0), project(-hw, hw, 0)];
}

// floorAreas: 층별 면적(㎡) 배열(아래층→위층 순). siteArea: 대지면적(㎡).
export function renderIsometricSvg(siteArea, floorAreas) {
  const siteSide = Math.sqrt(Math.max(siteArea, 0));
  const floorSides = floorAreas.map((a) => Math.sqrt(Math.max(a, 0)));
  const maxSide = Math.max(siteSide, ...floorSides, 1);
  const scale = TARGET_MAX_SIDE / maxSide;

  const siteHw = (siteSide * scale) / 2;
  const ground = groundOutline(siteHw);

  const floorPolys = [];
  let zBase = 0;
  floorSides.forEach((side, i) => {
    const hw = (side * scale) / 2;
    if (hw > 0) {
      const { top, left, right } = boxFaces(hw, zBase, zBase + FLOOR_HEIGHT);
      floorPolys.push({ top, left, right, index: i });
    }
    zBase += FLOOR_HEIGHT;
  });

  const allPoints = [...ground, ...floorPolys.flatMap((f) => [...f.top, ...f.left, ...f.right])];
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const pad = 6;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const w = maxX - minX;
  const h = maxY - minY;

  const groundSvg = `<polygon points="${pointsAttr(ground)}" fill="#eef2f7" stroke="#94a3b8" stroke-width="0.3" stroke-dasharray="1,1" />`;

  const floorsSvg = floorPolys
    .map(
      ({ top, left, right }) => `
        <polygon points="${pointsAttr(left)}" fill="#1d4ed8" opacity="0.75" />
        <polygon points="${pointsAttr(right)}" fill="#2563eb" opacity="0.9" />
        <polygon points="${pointsAttr(top)}" fill="#60a5fa" stroke="#1e3a8a" stroke-width="0.2" />
      `
    )
    .join('');

  return `
    <svg viewBox="${minX} ${minY} ${w} ${h}" width="100%" height="220" xmlns="http://www.w3.org/2000/svg">
      ${groundSvg}
      ${floorsSvg}
    </svg>
  `;
}
