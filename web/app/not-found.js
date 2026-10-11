import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card px-6 py-20 text-center">
      <div className="text-5xl font-semibold text-brand">404</div>
      <p className="mt-3 text-sm text-muted">This page does not exist.</p>
      <Link href="/" className="btn-ghost mt-6">
        Back to the explorer
      </Link>
    </div>
  );
}
