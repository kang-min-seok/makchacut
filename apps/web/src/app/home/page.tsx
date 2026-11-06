import { Suspense } from 'react';
import { HomeRegisterScreen } from '@/components/home-register/home-register-screen';

export default function HomeRegisterPage() {
  return (
    <Suspense>
      <HomeRegisterScreen />
    </Suspense>
  );
}
