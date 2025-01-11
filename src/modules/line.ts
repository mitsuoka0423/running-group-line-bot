import type { AppConfig } from '../types';

/**
 * LINEにメッセージを返信する
 * @param config - アプリケーション設定
 * @param replyToken - LINEの返信用トークン
 * @param messageText - 返信するメッセージ内容
 */
export function replyMessage(config: AppConfig, replyToken: string, messageText: string) {
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
