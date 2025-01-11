import type { AppConfig } from '../types';
import { getConfig } from './config';

/**
 * ログ用シートを作成する
 * @param config - アプリケーション設定
 */
export function createLogSheets(config: AppConfig) {
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);

  // 通常ログ用シート
  let logSheet = spreadsheet.getSheetByName(config.logSheetName);
  if (!logSheet) {
    logSheet = spreadsheet.insertSheet(config.logSheetName);
    logSheet.appendRow(['Timestamp', 'Function', 'Log Level', 'Message', 'Stack Trace']);
  }
}

/**
 * 通常ログを記録する
 * @param {string} functionName - ログを記録する関数名
 * @param {'ERROR' | 'INFO' | 'DEBUG'} level - ログレベル (INFO, DEBUG, etc.)
 * @param {string} message - ログメッセージ
 * @param {string} [stackTrace] - スタックトレース
 */
export function log(functionName: string, level: 'ERROR' | 'INFO' | 'DEBUG', message: string, stackTrace?: string) {
  try {
    const config = getConfig();
    const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(config.logSheetName);

    if (sheet) {
      sheet.appendRow([new Date().toISOString(), functionName, level, message, stackTrace]);
    }
  } catch (e) {
    console.error('Failed to log:', e);
  }
}

/**
 * エラーログを記録する
 * @param {string} functionName - エラーが発生した関数名
 * @param {Error} error - エラーオブジェクト
 */
export function logError(functionName: string, error: Error) {
  try {
    log(functionName, 'ERROR', error.message);
  } catch (e) {
    console.error('Failed to log error:', e);
  }
}
