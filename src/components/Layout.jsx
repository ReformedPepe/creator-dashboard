// Layout — kept for backward compatibility but simplified
export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-bg-page">
      {children}
    </div>
  );
}
