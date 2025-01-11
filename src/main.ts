import { getConfig } from './modules/config';
import type { AppConfig } from './types';
import { createLogSheets, log, logError } from './modules/logger';
import { replyMessage } from './modules/line';
import { analyzeRunningImage } from './modules/openai';
import { saveToSpreadsheet } from './modules/spreadsheet';

/**
 * LINEからのPOSTリクエストを処理する
 * @param {GoogleAppsScript.Events.DoPost} e - LINEからのPOSTイベント
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  const config = getConfig();
  
  log('doPost', 'INFO', 'start');
  try {
    createLogSheets(config);
    const event = JSON.parse(e.postData.contents).events[0];
    const replyToken = event.replyToken;

    if (event.message.type === 'image') {
      const imageUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
      processRunningImage(config, replyToken, imageUrl);
    } else {
      const messageText = event.message.text;
      replyMessage(config, replyToken, messageText);
    }
  } catch (error) {
    console.error('Error handling LINE webhook:', error);
    logError('doPost', error);
  }
  log('doPost', 'INFO', 'end');
}

/**
 * ランニング画像を処理する
 * @param config - アプリケーション設定
 * @param replyToken - LINEの返信用トークン
 * @param imageUrl - 処理対象の画像URL
 * @returns {Promise<void>}
 */
async function processRunningImage(config: AppConfig, replyToken: string, imageUrl: string) {
  log('processRunningImage', 'INFO', 'start');
  log('processRunningImage', 'DEBUG', `replyToken: *********, imageUrl: ${imageUrl}`);

  try {
    // 1. LINEから画像を取得
    const imageBlob = UrlFetchApp.fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${config.channelAccessToken}`,
      },
    }).getBlob();

    // 2. OpenAI APIで画像解析
    const record = await analyzeRunningImage(config, imageBlob);

    // 3. スプレッドシートに記録
    saveToSpreadsheet(config, record);

    // 4. 結果をLINEに返信
    const replyText = `記録を保存しました！

日時: ${record.date}
距離: ${record.distance}
時間: ${record.time}
ペース: ${record.pace}`;

    replyMessage(config, replyToken, replyText);
  } catch (error) {
    console.error('Error processing running image:', error);
    logError('processRunningImage', error);
    replyMessage(config, replyToken, '記録の処理に失敗しました。もう一度試してください。');
  } finally {
    log('processRunningImage', 'INFO', 'end');
  }
}
