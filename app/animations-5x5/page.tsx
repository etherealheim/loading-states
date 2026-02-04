import { AnimatedLoaders5x5Page } from "@/components/LoaderShowcase";

export default function Animations5x5Page() {
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Animations 5x5</h1>
        <p className="text-sm text-gray-500">Animated loaders on a 5x5 grid.</p>
      </header>
      <AnimatedLoaders5x5Page />
    </div>
  );
}
