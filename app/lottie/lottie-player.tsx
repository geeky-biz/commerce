'use client';

import Lottie from 'lottie-react';
import { useState } from 'react';

// Example Lottie animation URLs (you can replace these with your own)
const EXAMPLE_ANIMATIONS = [
  {
    name: 'Loading Animation',
    url: 'https://lottie.host/embed/5f5b5e5e-5e5e-5e5e-5e5e-5e5e5e5e5e5e/example.json',
    // Alternative: Use a local file path like '/animations/loading.json'
  },
  {
    name: 'Success Checkmark',
    url: 'https://lottie.host/embed/3f3f3f3f-3f3f-3f3f-3f3f-3f3f3f3f3f3f/example.json',
  },
  {
    name: 'Confetti',
    url: 'https://lottie.host/embed/4f4f4f4f-4f4f-4f4f-4f4f-4f4f4f4f4f4f/example.json',
  },
];

// Client component that handles Lottie animation interactions
export default function LottiePlayer() {
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [animationData, setAnimationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [speed, setSpeed] = useState(1);

  const loadAnimation = async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load animation: ${response.statusText}`);
      }
      const data = await response.json();
      setAnimationData(data);
      setSelectedAnimation(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load animation');
      setAnimationData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadLocalAnimation = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setAnimationData(data);
      setSelectedAnimation(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse animation file');
      setAnimationData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        {/* Controls Panel */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-2xl font-semibold">Controls</h2>

          {/* Animation Selection */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">Load Example Animation</label>
            <div className="space-y-2">
              {EXAMPLE_ANIMATIONS.map((anim, idx) => (
                <button
                  key={idx}
                  onClick={() => loadAnimation(anim.url)}
                  disabled={loading}
                  className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-left text-sm transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  {anim.name}
                </button>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium">Upload Local JSON File</label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadLocalAnimation(file);
              }}
              disabled={loading}
              className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:file:bg-neutral-700 dark:file:text-neutral-300"
            />
          </div>

          {/* Animation Settings */}
          {animationData && (
            <div className="space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <div>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium">Loop Animation</span>
                </label>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoplay}
                    onChange={(e) => setAutoplay(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium">Autoplay</span>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Speed: {speed}x
                </label>
                <input
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.25"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Animation Display */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-2xl font-semibold">Animation Preview</h2>

          {loading && (
            <div className="flex h-64 items-center justify-center">
              <div className="text-neutral-500">Loading animation...</div>
            </div>
          )}

          {error && (
            <div className="flex h-64 items-center justify-center rounded-md bg-red-50 p-4 dark:bg-red-900/20">
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
          )}

          {!loading && !error && !animationData && (
            <div className="flex h-64 items-center justify-center rounded-md border-2 border-dashed border-neutral-300 dark:border-neutral-700">
              <div className="text-center text-neutral-500">
                <p className="mb-2">No animation loaded</p>
                <p className="text-sm">Select an example or upload a JSON file</p>
              </div>
            </div>
          )}

          {!loading && !error && animationData && (
            <div className="flex items-center justify-center rounded-md bg-neutral-50 p-8 dark:bg-neutral-800">
              <Lottie
                animationData={animationData}
                loop={loop}
                autoplay={autoplay}
                {...({ speed } as any)}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          )}

          {selectedAnimation && (
            <div className="mt-4 rounded-md bg-neutral-100 p-3 text-xs dark:bg-neutral-800">
              <strong>Loaded:</strong> {selectedAnimation}
            </div>
          )}
        </div>
      </div>

      {/* Multiple Animations Grid */}
      {animationData && (
        <div className="mt-8">
          <h2 className="mb-4 text-2xl font-semibold">Multiple Animations Test</h2>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            Rendering multiple instances to test performance:
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="mb-2 text-xs font-medium text-neutral-500">Instance {idx + 1}</div>
                <Lottie
                  animationData={animationData}
                  loop={loop}
                  autoplay={autoplay}
                  {...({ speed } as any)}
                  style={{ width: '100%', height: 'auto' }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-3 text-lg font-semibold">How to use:</h3>
        <ul className="list-inside list-disc space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <li>Click on an example animation button to load a demo animation</li>
          <li>Or upload your own Lottie JSON file using the file input</li>
          <li>Adjust loop, autoplay, and speed settings to test different behaviors</li>
          <li>Multiple instances are rendered below to test performance with heavy JS components</li>
          <li>
            To use local files, place them in the <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">public</code> folder and reference them as{' '}
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">/your-file.json</code>
          </li>
        </ul>
      </div>
    </>
  );
}
