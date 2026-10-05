const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// public内の画像を、localhostとGitHub Pagesの両方で参照できるURLにする。
export function publicPath(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
