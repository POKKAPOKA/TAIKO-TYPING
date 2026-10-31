// ブラウザごとに一意のIDを発行してlocalStorageに保持する。
// ランキングで「同じ人の自己ベストのみ上書きする」ために使う
// （サーバー側は song_id + device_id の組をユニークにしてupsertを受け付ける）。
let fallbackDeviceId = null;

// セッション識別子は保存せず、プレイごとに暗号学的に安全な乱数で生成する。
export function createPlaySessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('安全なプレイセッションIDを生成できません');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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

