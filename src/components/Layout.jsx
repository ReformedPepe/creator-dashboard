// Layout — główny wrapper strony
export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-bg-page">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
