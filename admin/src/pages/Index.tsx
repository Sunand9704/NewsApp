import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BarChart3, FileClock, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const Dashboard = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard(30),
  });

  const analysesToday = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const items = data?.recentAnalyses ?? [];
    return items.filter((item) => new Date(item.createdAt).toDateString() === today).length;
  }, [data?.recentAnalyses]);

  const draftsCreated = useMemo(() => {
    if (!data?.summary) {
      return 0;
    }
    const remaining = data.summary.totalAnalyses - data.summary.savedArticles - data.summary.pendingReview;
    return remaining > 0 ? remaining : 0;
  }, [data?.summary]);

  const cards = [
    {
      title: "Analyses today",
      value: String(analysesToday),
      detail: "Created today",
      icon: BarChart3,
    },
    {
      title: "Drafts created",
      value: String(draftsCreated),
      detail: "Saved as draft",
      icon: FileClock,
    },
    {
      title: "Ready articles",
      value: String(data?.summary.savedArticles ?? 0),
      detail: "Completed workflow",
      icon: CheckCircle2,
    },
  ];

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quick summary cards. No heavy logic.</p>

        {isLoading && (
          <div className="mt-6 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Loading dashboard...
          </div>
        )}

        {!isLoading && error && (
          <div className="mt-6 rounded-xl border border-destructive/40 bg-card p-5 text-sm text-destructive shadow-sm">
            Failed to load dashboard.{" "}
            <button onClick={() => refetch()} className="underline">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-3xl font-semibold text-foreground">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
