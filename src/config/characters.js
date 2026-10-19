// ボーカリストキャラクター定義ファイル
// サークルメンバーの本番イラスト（透過PNG等）が揃った際は、
// sprites のパスを差し替えるか、配列にキャラクターを追加するだけで反映されます。

export const CHARACTERS = [
  {
    id: 'char_test',
    name: '桜音 ネオン (テスト用)',
    description: '和風サイバーライブステージのテスト用デフォルトボーカリスト',
    sprites: {
      sing_1: './assets/characters/char_test/sing_1.svg',
      sing_2: './assets/characters/char_test/sing_2.svg',
      miss: './assets/characters/char_test/miss.svg',
    },
  },
];

export const DEFAULT_CHARACTER_ID = 'char_test';

export function getCharacterById(characterId) {
  return CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];
}
