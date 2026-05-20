import './globals.css';
import type { Metadata } from 'next';
import { Newsreader, Geist, JetBrains_Mono } from 'next/font/google';
import { ToastViewport } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PromptDialog } from '@/components/ui/PromptDialog';
import { MotionProvider } from '@/components/providers/MotionProvider';

const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const sans = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GlobalTT Editor',
  description: 'Email campaign editor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <MotionProvider>
          {children}
          <ToastViewport />
          <ConfirmDialog />
          <PromptDialog />
        </MotionProvider>
      </body>
    </html>
  );
}
