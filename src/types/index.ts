/**
 * ランニング記録のインターフェース
 */
export interface RunningRecord {
  /** 日時 (YYYY-MM-DD HH:MM) */
  date: string;
  /** 走った距離 (km) */
  distance: string;
  /** 走った時間 (HH:MM:SS) */
  time: string;
  /** 1キロのペース (MM:SS/km) */
  pace: string;
}

/**
 * アプリケーション設定
 */
export interface AppConfig {
  channelAccessToken: string;
  openaiApiKey: string;
  spreadsheetId: string;
  logSheetName: string;
}
