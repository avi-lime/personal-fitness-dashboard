import { HubNav } from "@/components/layout/hub-nav";

export default function DayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubNav hub="day" />
      {children}
    </>
  );
}
