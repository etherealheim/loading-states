import Link from "next/link";

const navItems = [
  { href: "/actors", label: "Actor Cards" },
  { href: "/animations-5x5", label: "Animations 5x5" },
  { href: "/animations-3x3", label: "Animations 3x3" },
];

export function SideNavigation() {
  return (
    <aside className="w-64 border-r border-gray-200 bg-white px-4 py-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
          Loading States
        </p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
