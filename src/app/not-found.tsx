import Link from "next/link";
import { Camera } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <Camera className="h-8 w-8 text-brand-600" />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="max-w-sm text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist, or a gallery link may have been
        unpublished.
      </p>
      <Link href="/" className="btn-primary">
        Back home
      </Link>
    </div>
  );
}
