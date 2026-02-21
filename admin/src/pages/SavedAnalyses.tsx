import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ArrowLeft, FileText, Lightbulb } from "lucide-react";

const savedItems = [
  { id: 1, title: "Byju's Q3 FY26 Financial Report", category: "Finance", date: "2026-02-20", status: "Completed", facts: ["Loss: ₹487 Cr", "Revenue: ₹470 Cr", "Stock price low: ₹28.73"], gaps: ["Previous quarter loss?", "All-time high stock price?"], source: "Byju's reported a consolidated net loss of ₹487 crore for Q3 FY26, with revenue declining to ₹470 crore..." },
  { id: 2, title: "ISRO Gaganyaan Mission Update", category: "Science", date: "2026-02-19", status: "Pending", facts: ["Launch window: Q4 2026", "Budget: ₹12,000 Cr"], gaps: ["Crew selection status?"], source: "ISRO confirmed the Gaganyaan mission is on track for a Q4 2026 launch window..." },
  { id: 3, title: "RBI Monetary Policy Feb 2026", category: "Finance", date: "2026-02-18", status: "Completed", facts: ["Repo rate: 6.0%", "GDP forecast: 6.8%"], gaps: ["Inflation projection?", "Impact on housing loans?"], source: "The RBI maintained the repo rate at 6.0% in its February 2026 policy review..." },
  { id: 4, title: "Zomato-Blinkit Merger Analysis", category: "Technology", date: "2026-02-17", status: "Draft", facts: ["Deal value: ₹4,500 Cr", "Expected synergies: ₹800 Cr"], gaps: ["CCI approval timeline?"], source: "Zomato announced the formal merger with Blinkit in a deal valued at ₹4,500 crore..." },
];

const statusColor: Record<string, string> = {
  Completed: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Draft: "bg-muted text-muted-foreground border-border",
};

const SavedAnalyses = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = savedItems.find((s) => s.id === selectedId);

  if (selected) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedId(null)}
            className="mb-4 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to list
          </Button>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">
              {selected.title}
            </h1>
            <Badge variant="outline" className={statusColor[selected.status]}>
              {selected.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected.category} · {selected.date}
          </p>

          {/* Source */}
          <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-2">Source Text</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{selected.source}</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Facts */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Selected Facts</h3>
              </div>
              <ul className="divide-y divide-border">
                {selected.facts.map((fact, i) => (
                  <li key={i} className="px-5 py-3 text-sm text-foreground">
                    {fact}
                  </li>
                ))}
              </ul>
            </div>

            {/* Gaps */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                <Lightbulb className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">Selected Gaps</h3>
              </div>
              <ul className="divide-y divide-border">
                {selected.gaps.map((gap, i) => (
                  <li key={i} className="px-5 py-3 text-sm text-foreground">
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Saved Analyses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and review your saved editorial analyses.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {savedItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`transition-colors hover:bg-muted/30 ${idx !== savedItems.length - 1 ? "border-b border-border" : ""}`}
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-foreground">{item.title}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.category}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.date}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant="outline" className={`text-xs ${statusColor[item.status]}`}>
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedId(item.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SavedAnalyses;
