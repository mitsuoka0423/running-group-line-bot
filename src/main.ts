/*
 * ## ルール
 *
 * - ソースコードはすべて`main.ts`に記載する
 * - 適切な粒度で関数に分割する
 * - 関数には開始と終了のログを出力する
 * - JSDoc形式で関数の説明を記述する
 */

/**
 * LINE Messaging APIのアクセストークン
 * @type {string}
 */
const CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('CHANNEL_ACCESS_TOKEN');

/**
 * ログ用シート名
 * @type {string}
 */
const LOG_SHEET_NAME = 'AppLog';

/**
 * エラーログ用シート名
 * @type {string}
 */
const ERROR_LOG_SHEET_NAME = 'ErrorLog';

/**
 * ログ用シートを作成する
 */
function createLogSheets() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 通常ログ用シート
  let logSheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
    logSheet.appendRow(['Timestamp', 'Function', 'Log Level', 'Message']);
  }
  
  // エラーログ用シート
  let errorSheet = spreadsheet.getSheetByName(ERROR_LOG_SHEET_NAME);
  if (!errorSheet) {
    errorSheet = spreadsheet.insertSheet(ERROR_LOG_SHEET_NAME);
    errorSheet.appendRow(['Timestamp', 'Function', 'Error Message', 'Stack Trace']);
  }
}

/**
 * 通常ログを記録する
 * @param {string} functionName - ログを記録する関数名
 * @param {string} level - ログレベル (INFO, DEBUG, etc.)
 * @param {string} message - ログメッセージ
 */
function log(functionName: string, level: string, message: string) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
    
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        functionName,
        level,
        message
      ]);
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
function logError(functionName: string, error: Error) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(ERROR_LOG_SHEET_NAME);
    
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        functionName,
        error.message,
        error.stack || ''
      ]);
    }
  } catch (e) {
    console.error('Failed to log error:', e);
  }
}

/**
 * OpenAI APIのアクセスキー
 * @type {string}
 */
const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');

/**
 * スプレッドシートのID
 * @type {string}
 */
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');

/**
 * ランニング記録のインターフェース
 * @interface
 */
interface RunningRecord {
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
 * LINEからのPOSTリクエストを処理する
 * @param {GoogleAppsScript.Events.DoPost} e - LINEからのPOSTイベント
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  console.log('doPost start');
  try {
    createLogSheets();
    const event = JSON.parse(e.postData.contents).events[0];
    const replyToken = event.replyToken;
    
    if (event.message.type === 'image') {
      const imageUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
      processRunningImage(replyToken, imageUrl);
    } else {
      const messageText = event.message.text;
      replyMessage(replyToken, messageText);
    }
  } catch (error) {
    console.error('Error handling LINE webhook:', error);
    logError('doPost', error);
  }
  console.log('doPost end');
}

/**
 * ランニング画像を処理する
 * @param {string} replyToken - LINEの返信用トークン
 * @param {string} imageUrl - 処理対象の画像URL
 * @returns {Promise<void>}
 */
async function processRunningImage(replyToken: string, imageUrl: string) {
  try {
    // 1. LINEから画像を取得
    const imageBlob = UrlFetchApp.fetch(imageUrl, {
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
      }
    }).getBlob();
    
    // 2. OpenAI APIで画像解析
    const record = await analyzeRunningImage(imageBlob);
    
    // 3. スプレッドシートに記録
    saveToSpreadsheet(record);
    
    // 4. 結果をLINEに返信
    const replyText = `記録を保存しました！

日時: ${record.date}
距離: ${record.distance}
時間: ${record.time}
ペース: ${record.pace}`;
    
    replyMessage(replyToken, replyText);
  } catch (error) {
    console.error('Error processing running image:', error);
    logError('processRunningImage', error);
    replyMessage(replyToken, '記録の処理に失敗しました。もう一度試してください。');
  }
}

/**
 * OpenAI APIを使用してランニング画像を解析する
 * @param {GoogleAppsScript.Base.Blob} imageBlob - 解析対象の画像Blob
 * @returns {Promise<RunningRecord>} 解析結果のランニング記録
 */
async function analyzeRunningImage(imageBlob: GoogleAppsScript.Base.Blob): Promise<RunningRecord> {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());
  
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    payload: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'この画像からランニング記録を抽出してください。以下の情報をJSON形式で返してください。\n' +
                  '- date: 日時 (YYYY-MM-DD HH:MM)\n' +
                  '- distance: 走った距離 (km)\n' +
                  '- time: 走った時間 (HH:MM:SS)\n' +
                  '- pace: 1キロのペース (MM:SS/km)'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }]
    })
  });
  
  const result = JSON.parse(response.getContentText());
  return JSON.parse(result.choices[0].message.content);
}

/**
 * ランニング記録をスプレッドシートに保存する
 * @param {RunningRecord} record - 保存するランニング記録
 */
function saveToSpreadsheet(record: RunningRecord) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  sheet.appendRow([
    record.date,
    record.distance,
    record.time,
    record.pace
  ]);
}

/**
 * LINEにメッセージを返信する
 * @param {string} replyToken - LINEの返信用トークン
 * @param {string} messageText - 返信するメッセージ内容
 */
function replyMessage(replyToken: string, messageText: string) {
  console.log('replyMessage start');
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{
        type: 'text',
        text: messageText
      }]
    })
  };

  UrlFetchApp.fetch(url, options);
  console.log('replyMessage end');
}
