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

const summaryCards = [
  { label: "Total Analyses", value: "128", icon: BarChart3, change: "+12 this week" },
  { label: "Pending Reviews", value: "7", icon: Clock, change: "3 urgent" },
  { label: "Saved Articles", value: "94", icon: Archive, change: "+5 today" },
  { label: "AI Usage", value: "68%", icon: Zap, change: "2,140 / 3,000 tokens" },
];

const recentAnalyses = [
  { id: 1, title: "Byju's Q3 FY26 Financial Report", date: "2026-02-20", status: "Completed" },
  { id: 2, title: "ISRO Gaganyaan Mission Update", date: "2026-02-19", status: "Pending" },
  { id: 3, title: "RBI Monetary Policy Feb 2026", date: "2026-02-18", status: "Completed" },
  { id: 4, title: "Zomato-Blinkit Merger Analysis", date: "2026-02-17", status: "Draft" },
  { id: 5, title: "India GDP Q3 Estimates", date: "2026-02-16", status: "Completed" },
];

const statusColor: Record<string, string> = {
  Completed: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Draft: "bg-muted text-muted-foreground border-border",
};

const Dashboard = () => {
  const navigate = useNavigate();

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
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-muted/30 ${idx !== recentAnalyses.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground">{item.title}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.date}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className={`text-xs ${statusColor[item.status]}`}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
