import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Error 404</p>
        <h1 className="mt-4 text-3xl font-semibold text-foreground sm:text-4xl">
          Page not found or access restricted
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          The page you are looking for does not exist, or you do not have permission to view it.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
