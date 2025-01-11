# running-group-line-bot

## 前提条件

- Node.jsがインストールされていること
- claspがインストールされていること (`npm install -g @google/clasp`)
- Google Apps Scriptプロジェクトが作成され、リンクされていること

## デプロイ手順

1. 依存関係をインストール:

```bash
npm install
```

1. Google Apps Scriptにコードをプッシュ:

```bash
npx clasp push
```

1. 新しいバージョンをデプロイ:

```bash
npx clasp deploy
```

1. (オプション) Google Apps Scriptエディタを開く:

```bash
npx clasp open
```

## バージョン管理

- 各デプロイで新しいバージョンが作成されます
- デプロイ済みバージョンを確認:

```bash
npx clasp versions
```

## DevContainerの利用

このプロジェクトはDevContainerをサポートしています。VSCodeで開くと自動的に開発環境が構築されます。

### 主な特徴

- Node.js環境が自動セットアップ
- 必要なツールが事前インストール
- 依存関係が自動解決

### 使い方

1. VSCodeでこのプロジェクトを開く
2. 左下の緑色の「><」アイコンをクリック
3. 「Reopen in Container」を選択
4. コンテナが起動するのを待つ

## トラブルシューティング

- コードが更新されない場合:
  1. `npx clasp push`
  2. `npx clasp deploy`
- デプロイ状況を確認:

```bash
npx clasp deployments
