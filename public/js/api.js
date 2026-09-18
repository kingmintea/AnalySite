export async function fetchParcelInfo(address) {
  const res = await fetch(`/api/parcel-info?address=${encodeURIComponent(address)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error?.message || `요청 실패 (${res.status})`);
  }
  return body;
}
