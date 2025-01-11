import type { AppConfig, RunningRecord } from '../types';

/**
 * OpenAI APIを使用してランニング画像を解析する
 * @param config - アプリケーション設定
 * @param imageBlob - 解析対象の画像Blob
 * @returns {Promise<RunningRecord>} 解析結果のランニング記録
 */
export async function analyzeRunningImage(
  config: AppConfig,
  imageBlob: GoogleAppsScript.Base.Blob
): Promise<RunningRecord> {
  const base64Image = Utilities.base64Encode(imageBlob.getBytes());

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
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
  return JSON.parse(body.choices[0].message.content);
}
