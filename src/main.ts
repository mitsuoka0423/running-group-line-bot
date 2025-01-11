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
const LOG_SHEET_NAME = 'ログ';

/**
 * ログ用シートを作成する
 */
function createLogSheets() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 通常ログ用シート
  let logSheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);
  if (!logSheet) {
    logSheet = spreadsheet.insertSheet(LOG_SHEET_NAME);
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
function log(functionName: string, level: 'ERROR' | 'INFO' | 'DEBUG', message: string, stackTrace?: string) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(LOG_SHEET_NAME);

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
function logError(functionName: string, error: Error) {
  try {
    log(functionName, 'ERROR', error.message);
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
  log('doPost', 'INFO', 'start');
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
  log('doPost', 'INFO', 'end');
}

/**
 * ランニング画像を処理する
 * @param {string} replyToken - LINEの返信用トークン
 * @param {string} imageUrl - 処理対象の画像URL
 * @returns {Promise<void>}
 */
async function processRunningImage(replyToken: string, imageUrl: string) {
  log('processRunningImage', 'INFO', 'start');
  log('processRunningImage', 'DEBUG', `replyToken: *********, imageUrl: ${imageUrl}`);

  try {
    // 1. LINEから画像を取得
    const imageBlob = UrlFetchApp.fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
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
  } finally {
    log('processRunningImage', 'INFO', 'end');
  }
}

/**
 * OpenAI APIを使用してランニング画像を解析する
 * @param {GoogleAppsScript.Base.Blob} imageBlob - 解析対象の画像Blob
 * @returns {Promise<RunningRecord>} 解析結果のランニング記録
 */
async function analyzeRunningImage(imageBlob: GoogleAppsScript.Base.Blob): Promise<RunningRecord> {
  log('analyzeRunningImage', 'INFO', 'start');

  const base64Image = Utilities.base64Encode(imageBlob.getBytes());

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    payload: JSON.stringify({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'この画像からランニング記録を抽出してください。以下の情報をJSON形式で返してください。\n' +
                '- date: 日時 (YYYY-MM-DD HH:MM)\n' +
                '- distance: 走った距離 (km)\n' +
                '- time: 走った時間 (HH:MM:SS)\n' +
                '- pace: 1キロのペース (MM:SS/km)',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    }),
  });

  const body = JSON.parse(response.getContentText());
  log('analyzeRunningImage', 'DEBUG', JSON.stringify(body));

  const result = JSON.parse(body.choices[0].message.content);
  log('analyzeRunningImage', 'DEBUG', JSON.stringify(result));

  log('analyzeRunningImage', 'INFO', 'end');

  return result;
}

/**
 * ランニング記録をスプレッドシートに保存する
 * @param {RunningRecord} record - 保存するランニング記録
 */
function saveToSpreadsheet(record: RunningRecord) {
  log('saveToSpreadsheet', 'INFO', 'start');
  log('saveToSpreadsheet', 'DEBUG', JSON.stringify(record));
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  sheet.appendRow([record.date, record.distance, record.time, record.pace]);
  log('saveToSpreadsheet', 'INFO', 'end');
}

/**
 * LINEにメッセージを返信する
 * @param {string} replyToken - LINEの返信用トークン
 * @param {string} messageText - 返信するメッセージ内容
 */
function replyMessage(replyToken: string, messageText: string) {
  log('replyMessage', 'INFO', 'start');
  log('replyMessage', 'DEBUG', `replyToken: ${replyToken}, messageText: ${messageText}`);
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: messageText,
        },
      ],
    }),
  };

  UrlFetchApp.fetch(url, options);
  log('replyMessage', 'INFO', 'end');
}
