import type { WebhookRequestBody } from '@line/bot-sdk';

/**
 * ランニング記録のインターフェース
 */
interface RunningRecord {
  /** ユーザーID */
  userId: string;
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
interface AppConfig {
  channelAccessToken: string;
  openaiApiKey: string;
  spreadsheetId: string;
  logSheetName: string;
}

/**
 * アプリケーション設定を取得する
 */
function getConfig(): AppConfig {
  const properties = PropertiesService.getScriptProperties();

  return {
    channelAccessToken: properties.getProperty('CHANNEL_ACCESS_TOKEN') || '',
    openaiApiKey: properties.getProperty('OPENAI_API_KEY') || '',
    spreadsheetId: properties.getProperty('SPREADSHEET_ID') || '',
    logSheetName: 'ログ',
  };
}

/**
 * ログ用シートを作成する
 * @param config - アプリケーション設定
 */
function createLogSheets(config: AppConfig) {
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
function log(functionName: string, level: 'ERROR' | 'INFO' | 'DEBUG', message: string, stackTrace?: string) {
  try {
    const config = getConfig();
    const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(config.logSheetName);

    if (level === 'ERROR') {
      console.error([new Date().toISOString(), functionName, level, message, stackTrace]);
    } else {
      console.info([new Date().toISOString(), functionName, level, message]);
    }

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
 * LINEにメッセージを返信する
 * @param config - アプリケーション設定
 * @param replyToken - LINEの返信用トークン
 * @param messageText - 返信するメッセージ内容
 */
function replyMessage(config: AppConfig, replyToken: string, messageText: string) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.channelAccessToken}`,
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
}

/**
 * OpenAI APIを使用してランニング画像を解析する
 * @param config - アプリケーション設定
 * @param imageBlob - 解析対象の画像Blob
 * @returns {Promise<RunningRecord>} 解析結果のランニング記録
 */
async function analyzeRunningImage(config: AppConfig, imageBlob: GoogleAppsScript.Base.Blob): Promise<RunningRecord> {
  log('analyzeRunningImage', 'INFO', 'start');
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    payload: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: '送られた画像からデータを抽出して',
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'RunningRecord',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: '日時 (YYYY-MM-DD HH:MM)',
              },
              distance: {
                type: 'string',
                description: '走った距離 (km)',
              },
              time: {
                type: 'string',
                description: '走った時間 (HH:MM:SS)',
              },
              pace: {
                type: 'string',
                description: '1キロのペース (MM:SS/km)',
              },
            },
            required: ['date', 'distance', 'time', 'pace'],
            additionalProperties: false,
          },
        },
      },
      temperature: 1,
      max_completion_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    }),
  });

  const body = JSON.parse(response.getContentText());
  log('analyzeRunningImage', 'DEBUG', `body ${JSON.stringify(body, null, 2)}`);

  // レスポンスの内容からJSONを抽出
  let content = body.choices[0].message.content;

  // コードブロックで囲まれている場合は、JSONの部分だけを抽出
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    content = jsonMatch[1];
  }

  const result = JSON.parse(content);
  log('analyzeRunningImage', 'DEBUG', `result ${JSON.stringify(result, null, 2)}`);

  log('analyzeRunningImage', 'INFO', 'end');

  return result;
}

/**
 * ランニング記録をスプレッドシートに保存する
 * @param config - アプリケーション設定
 * @param record - 保存するランニング記録
 */
function saveToSpreadsheet(config: AppConfig, record: RunningRecord) {
  const sheet = SpreadsheetApp.openById(config.spreadsheetId).getActiveSheet();
  sheet.appendRow([record.date, record.distance, record.time, record.pace, record.userId]);
}

/**
 * LINEからのPOSTリクエストを処理する
 * @param {GoogleAppsScript.Events.DoPost} e - LINEからのPOSTイベント
 */
function doPost(e: GoogleAppsScript.Events.DoPost) {
  log('doPost', 'INFO', 'start');
  const config = getConfig();
  try {
    createLogSheets(config);
    const body = JSON.parse(e.postData.contents) as WebhookRequestBody;

    for (const event of body.events) {
      log('doPost', 'DEBUG', `event: ${JSON.stringify(event, null, 2)}`);

      switch (event.type) {
        case 'message':
          if (event.message.type === 'image') {
            const replyToken = event.replyToken;
            const imageUrl = `https://api-data.line.me/v2/bot/message/${event.message.id}/content`;
            processRunningImage(config, replyToken, imageUrl, event);
          } else if (event.message.type === 'text') {
            const replyToken = event.replyToken;
            const messageText = event.message.text;
            replyMessage(config, replyToken, messageText);
          }
          break;
        default:
          log('doPost', 'INFO', `Unsupported event type: ${event.type}`);
      }
    }
  } catch (error) {
    error('Error handling LINE webhook:', error);
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
async function processRunningImage(config: AppConfig, replyToken: string, imageUrl: string, event: WebhookRequestBody['events'][0]) {
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
    
    // ユーザーIDを追加
    record.userId = event.source?.userId || 'unknown';

    // 3. スプレッドシートに記録
    saveToSpreadsheet(config, record);

    // 4. 結果をLINEに返信
    const replyText = `記録しました！

日時: ${record.date}
距離: ${record.distance}
時間: ${record.time}
ペース: ${record.pace}`;

    replyMessage(config, replyToken, replyText);
  } catch (error) {
    error('Error processing running image:', error);
    logError('processRunningImage', error);
    replyMessage(config, replyToken, '記録の処理に失敗しました。もう一度試してください。');
  } finally {
    log('processRunningImage', 'INFO', 'end');
  }
}
