import type { AppConfig, RunningRecord } from '../types';
import { log } from './logger';

/**
 * OpenAI APIを使用してランニング画像を解析する
 * @param config - アプリケーション設定
 * @param imageBlob - 解析対象の画像Blob
 * @returns {Promise<RunningRecord>} 解析結果のランニング記録
 */
export async function analyzeRunningImage(config: AppConfig, imageBlob: GoogleAppsScript.Base.Blob): Promise<RunningRecord> {
  log('analyzeRunningImage', 'INFO', 'start');
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    payload: JSON.stringify({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          "role": "system",
          "content": "You are an expert at structured data extraction."
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'この画像からランニング記録を抽出してください。',
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
            required: ['date', 'distance', 'time'],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  const body = JSON.parse(response.getContentText());
  log('analyzeRunningImage', 'DEBUG', `body ${JSON.stringify(body, null, 2)}`);

  const result = JSON.parse(body.choices[0].message.content);
  log('analyzeRunningImage', 'DEBUG', `result ${JSON.stringify(result, null, 2)}`);

  log('analyzeRunningImage', 'INFO', 'end');

  return result;
}
