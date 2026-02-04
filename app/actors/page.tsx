import { ActorsRunShowcase } from "@/components/LoaderShowcase";

export default function ActorsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">Actor Cards</h1>
        <p className="text-sm text-gray-500">Usage cards with animated dot grid.</p>
      </header>
      <ActorsRunShowcase />
    </div>
  );
}
