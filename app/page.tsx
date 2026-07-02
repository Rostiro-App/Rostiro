import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">ROSTIRO</h1>
        <p className="text-zinc-400 text-lg mb-8">Run Every League.</p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-white text-black font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-zinc-100 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/login"
            className="border border-zinc-700 text-zinc-300 font-medium px-6 py-2.5 rounded-lg text-sm hover:border-zinc-500 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
