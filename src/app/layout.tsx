import type { Metadata } from "next";
import type { ReactNode } from "react";

import { publicPath } from "../lib/publicPath";

import "./globals.css";

export const metadata: Metadata = {
  title: "ぶるさぁ。専用予定調査アプリ",
  description: "ぶるさぁ。の曲練習予定を作成するアプリ",
  icons: {
    icon: publicPath("/burusaa-logo.png"),
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
