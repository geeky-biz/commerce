import LottiePlayer from './lottie-player';

// Server component that renders the page title and description
export default function LottiePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="mb-8 text-4xl font-bold">Lottie Animation Test Page</h1>
      <p className="mb-8 text-lg text-neutral-600 dark:text-neutral-400">
        Test heavy JavaScript components with Lottie animations. Load animations from URLs or upload local JSON files.
      </p>
      <LottiePlayer />
    </div>
  );
}
