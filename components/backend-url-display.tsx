"use client"

export default function BackendUrlDisplay() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "Not set"

  return (
    <div className="mt-2 text-xs text-slate-400">
      <p>Backend URL: {backendUrl}</p>
    </div>
  )
}
