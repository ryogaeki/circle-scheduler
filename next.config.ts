import type { NextConfig } from "next";

const pagesBasePath = (process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // GitHub Pagesへ置けるよう、Node.jsサーバー不要のoutフォルダを作る。
  output: "export",
  trailingSlash: true,
  basePath: pagesBasePath,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: pagesBasePath,
  },
  // localhost以外に127.0.0.1で開いた場合も、開発用通信を許可する。
  allowedDevOrigins: ["127.0.0.1"],
  // 既存のAGENTS.mdは、このプロジェクト自身の作業ルールとして管理する。
  agentRules: false,
  // この環境ではCLI出力の解析が不安定なため、TypeScript APIで型検査する。
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
