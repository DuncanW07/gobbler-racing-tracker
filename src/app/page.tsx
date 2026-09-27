export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50">
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-orange-500">
        Gobbler Racing
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Consumables Tracker
      </h1>
      <p className="mt-4 max-w-md text-zinc-400">
        Pipeline is live: this page is running on Vercel, connected to
        GitHub, and ready to talk to Supabase. Real tracker screens go here
        next.
      </p>
    </div>
  );
}
