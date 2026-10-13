import { HubNav } from "@/components/layout/hub-nav";

export default function HealthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubNav hub="health" />
      {children}
    </>
  );
}
