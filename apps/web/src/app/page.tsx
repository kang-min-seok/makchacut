import { EngineCheck } from '@/components/engine-check/engine-check';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">막차컷</h1>
      <EngineCheck />
    </main>
  );
}
