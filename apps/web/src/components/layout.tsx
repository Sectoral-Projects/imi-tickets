import "@/App.css";
import { Outlet } from "react-router";
import { Navbar } from "@/components/navbar";
import Footer from "@/components/footer";
import { useSetupRedirect } from "@/lib/use-auth-gate";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <Navbar className="shrink-0" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      <Footer className="shrink-0" />
    </div>
  );
}

export default function App() {
  useSetupRedirect();

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function ErrorBoundary() {}
