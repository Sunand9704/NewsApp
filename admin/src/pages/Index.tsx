import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BarChart3, FileClock, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quick summary cards. No heavy logic.</p>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Loading dashboard...</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && error && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">
                Failed to load dashboard.{" "}
                <button onClick={() => refetch()} className="underline">
                  Retry
                </button>
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.detail}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
