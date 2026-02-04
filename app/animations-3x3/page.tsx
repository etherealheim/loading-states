import { AnimatedLoaders3x3Page } from "@/components/LoaderShowcase";

export default function Animations3x3Page() {
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Animations 3x3</h1>
        <p className="text-sm text-gray-500">Compact 3x3 loaders with bloom.</p>
      </header>
      <AnimatedLoaders3x3Page />
    </div>
  );
}
