import { Spinner } from './Spinner';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-[var(--bg-darkest)]/80 flex flex-col items-center justify-center z-50">
      <Spinner size="lg" />
      <p className="mt-4 text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}
