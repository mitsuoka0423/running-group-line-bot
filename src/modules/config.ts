import type { AppConfig } from '../types';

/**
 * アプリケーション設定を取得する
 */
export function getConfig(): AppConfig {
  const properties = PropertiesService.getScriptProperties();

  return {
    channelAccessToken: properties.getProperty('CHANNEL_ACCESS_TOKEN') || '',
    openaiApiKey: properties.getProperty('OPENAI_API_KEY') || '',
    spreadsheetId: properties.getProperty('SPREADSHEET_ID') || '',
    logSheetName: 'ログ',
  };
}
