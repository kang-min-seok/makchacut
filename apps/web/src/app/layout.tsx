import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Noto_Sans_KR } from 'next/font/google';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  preload: false,
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '막차컷',
  description: '약속 장소에서 늦어도 몇 시에 출발해야 집에 가는지 알려드려요',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>
        </QueryProvider>
      </body>
    </html>
  );
}
