interface ErrorPageProps {
  url: string;
  message: string;
  onRetry: () => void;
}

export function ErrorPage({ url, message, onRetry }: ErrorPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
        <svg
          className="h-7 w-7 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          />
        </svg>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-neutral-200">
          No se pudo cargar la página
        </h2>
        <p className="max-w-md text-sm text-neutral-500">{message}</p>
      </div>

      {url && (
        <p className="max-w-md truncate rounded-md bg-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-400">
          {url}
        </p>
      )}

      <button
        onClick={onRetry}
        className="rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white"
      >
        Reintentar
      </button>
    </div>
  );
}