import { SignupForm } from '@/components/auth/SignupForm';

export const metadata = { title: 'Sign up - GlobalTT Editor' };

export default function SignupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <SignupForm />
    </main>
  );
}
