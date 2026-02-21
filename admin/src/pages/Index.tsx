import { DashboardLayout } from "@/components/DashboardLayout";
import {
  BarChart3,
  Clock,
  Archive,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const statusColor: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  draft: "bg-muted text-muted-foreground border-border",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard(8),
  });

  const summaryCards = [
    {
      label: "Total Analyses",
      value: String(data?.summary.totalAnalyses ?? 0),
      icon: BarChart3,
      change: "Total records in database",
    },
    {
      label: "Pending Reviews",
      value: String(data?.summary.pendingReview ?? 0),
      icon: Clock,
      change: "Awaiting confirmation",
    },
    {
      label: "Saved Articles",
      value: String(data?.summary.savedArticles ?? 0),
      icon: Archive,
      change: "Completed analyses",
    },
    {
      label: "AI Usage",
      value: `${data?.summary.aiUsagePct ?? 0}%`,
      icon: Zap,
      change: data?.summary.aiUsageText ?? "0 included / 0 total facts",
    },
  ];

  const recentAnalyses = data?.recentAnalyses ?? [];

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your editorial analysis pipeline.
        </p>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.change}</p>
            </div>
          ))}
        </div>

        {/* Recent Analyses */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Analyses</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/saved")} className="text-muted-foreground">
              View all
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={4}>
                      Loading dashboard data...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td className="px-5 py-6 text-sm text-destructive" colSpan={4}>
                      Failed to load dashboard data.{" "}
                      <button onClick={() => refetch()} className="underline">
                        Retry
                      </button>
                    </td>
                  </tr>
                )}

                {!isLoading && !error && recentAnalyses.length === 0 && (
                  <tr>
                    <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={4}>
                      No analyses found in the database.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !error &&
                  recentAnalyses.map((item, idx) => {
                    const statusKey = item.status.toLowerCase();
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-muted/30 ${idx !== recentAnalyses.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <td className="px-5 py-3.5 text-sm font-medium text-foreground">{item.title}</td>
                        <td className="px-5 py-3.5 text-sm text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="outline" className={`text-xs ${statusColor[statusKey] ?? statusColor.draft}`}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => navigate(`/saved/${item.id}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
