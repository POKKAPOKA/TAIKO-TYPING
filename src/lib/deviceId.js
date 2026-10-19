// ブラウザごとに一意のIDを発行してlocalStorageに保持する。
// ランキングで「同じ人の自己ベストのみ上書きする」ために使う
// （サーバー側は song_id + device_id の組をユニークにしてupsertを受け付ける）。
let fallbackDeviceId = null;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getDeviceId() {
  const key = "taiko_device_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = generateId();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    if (!fallbackDeviceId) {
      fallbackDeviceId = generateId();
    }
    return fallbackDeviceId;
  }
}

