import './globals.css';
import type { Metadata } from 'next';
import { ToastViewport } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MotionProvider } from '@/components/providers/MotionProvider';

export const metadata: Metadata = {
  title: 'GlobalTT Editor',
  description: 'Email campaign editor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <MotionProvider>
          {children}
          <ToastViewport />
          <ConfirmDialog />
        </MotionProvider>
      </body>
    </html>
  );
}
