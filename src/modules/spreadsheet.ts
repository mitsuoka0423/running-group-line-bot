import type { AppConfig, RunningRecord } from '../types';

/**
 * ランニング記録をスプレッドシートに保存する
 * @param config - アプリケーション設定
 * @param record - 保存するランニング記録
 */
export function saveToSpreadsheet(config: AppConfig, record: RunningRecord) {
  const sheet = SpreadsheetApp.openById(config.spreadsheetId).getActiveSheet();
  sheet.appendRow([record.date, record.distance, record.time, record.pace]);
}
