import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf2ec] p-6 text-[#17221b]">
      <div className="max-w-md rounded-3xl border border-[#ccd8cc] bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-[#397352]">
          Page not found
        </p>
        <h1 className="mt-3 text-3xl font-bold">This route is not in the plan.</h1>
        <p className="mt-3 text-sm text-[#53655a]">
          Return to the ClearPath studio to inspect the live classroom model.
        </p>
        <Link
          href="/studio"
          className="mt-6 inline-flex rounded-full bg-[#163f31] px-5 py-3 text-sm font-bold text-white"
        >
          Open the studio
        </Link>
      </div>
    </main>
  );
}
