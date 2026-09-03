'use client';

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf2ec] p-6 text-[#17221b]">
      <div className="max-w-md rounded-3xl border border-[#e7b69c] bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-[#8b3f24]">
          ClearPath error
        </p>
        <h1 className="mt-3 text-3xl font-bold">The studio could not load.</h1>
        <p className="mt-3 text-sm text-[#53655a]">
          Your last committed browser state has not been changed by this error.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-full bg-[#163f31] px-5 py-3 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
