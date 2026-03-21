import GuitarForgeApp from "@/components/GuitarForgeApp";
import AuthProvider from "@/components/AuthProvider";

export default function Home() {
  return (
    <AuthProvider>
      <GuitarForgeApp />
    </AuthProvider>
  );
}
