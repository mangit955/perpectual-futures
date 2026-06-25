"use client";

export default function DebugPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const useRealApi = process.env.NEXT_PUBLIC_USE_REAL_API;

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Debug</h1>
      <div className="space-y-2 font-mono text-sm">
        <div>
          <strong>NEXT_PUBLIC_API_URL:</strong> {apiUrl || "NOT SET"}
        </div>
        <div>
          <strong>NEXT_PUBLIC_WS_URL:</strong> {wsUrl || "NOT SET"}
        </div>
        <div>
          <strong>NEXT_PUBLIC_USE_REAL_API:</strong> {useRealApi || "NOT SET"}
        </div>
      </div>
    </div>
  );
}
