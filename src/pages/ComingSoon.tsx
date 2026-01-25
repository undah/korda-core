import { MainLayout } from "@/components/layout/MainLayout";
import { Construction } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
};

export default function ComingSoon({ title, subtitle }: Props) {
  return (
    <MainLayout>
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="glass-card p-8 max-w-xl w-full text-center animate-fade-in">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Construction className="w-6 h-6 text-primary" />
          </div>

          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-2">
            {subtitle ?? "Coming soon."}
          </p>

          <div className="mt-6 text-xs text-muted-foreground/70">
            This page is disabled for now.
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
