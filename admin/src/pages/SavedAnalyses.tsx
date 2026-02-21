import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ArrowLeft, FileText, Lightbulb } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const statusColor: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  draft: "bg-muted text-muted-foreground border-border",
};

const SavedAnalyses = () => {
  const navigate = useNavigate();
  const { analysisId } = useParams();
  const [showFullSource, setShowFullSource] = useState(false);
  const selectedID = Number(analysisId);
  const hasSelectedID = Number.isFinite(selectedID) && selectedID > 0;

  const listQuery = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api.listAnalyses(200),
  });

  const detailQuery = useQuery({
    queryKey: ["analysis", selectedID],
    queryFn: () => api.getAnalysis(selectedID),
    enabled: hasSelectedID,
  });

  useEffect(() => {
    setShowFullSource(false);
  }, [selectedID]);

  const sourceText = detailQuery.data?.rawText || "No source text found.";
  const shouldTruncateSource = useMemo(() => sourceText.length > 320, [sourceText]);

  if (hasSelectedID) {
    return (
      <DashboardLayout>
        <div className="animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/saved")}
            className="mb-4 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to list
          </Button>

          {detailQuery.isLoading && (
            <div className="text-sm text-muted-foreground">Loading analysis details...</div>
          )}

          {!detailQuery.isLoading && detailQuery.error && (
            <div className="text-sm text-destructive">
              Failed to load this analysis.{" "}
              <button onClick={() => detailQuery.refetch()} className="underline">
                Retry
              </button>
            </div>
          )}

          {!detailQuery.isLoading && !detailQuery.error && detailQuery.data && (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                  {detailQuery.data.title}
                </h1>
                <Badge
                  variant="outline"
                  className={statusColor[detailQuery.data.status.toLowerCase()] ?? statusColor.draft}
                >
                  {detailQuery.data.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {detailQuery.data.category} - {new Date(detailQuery.data.createdAt).toLocaleString()}
              </p>

              <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-2">Source Text</h3>
                <p
                  className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"
                  style={
                    !showFullSource && shouldTruncateSource
                      ? {
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }
                      : undefined
                  }
                >
                  {sourceText}
                </p>
                {shouldTruncateSource && (
                  <button
                    onClick={() => setShowFullSource((value) => !value)}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    {showFullSource ? "Show less source text" : "See full source text"}
                  </button>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Selected Facts</h3>
                  </div>
                  <ul className="divide-y divide-border">
                    {detailQuery.data.facts.length === 0 && (
                      <li className="px-5 py-3 text-sm text-muted-foreground">No facts found.</li>
                    )}
                    {detailQuery.data.facts.map((fact) => (
                      <li key={fact.id} className="px-5 py-3 text-sm text-foreground">
                        {fact.text}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                    <Lightbulb className="h-4 w-4 text-warning" />
                    <h3 className="text-sm font-semibold text-foreground">Selected Gaps</h3>
                  </div>
                  <ul className="divide-y divide-border">
                    {detailQuery.data.gaps.length === 0 && (
                      <li className="px-5 py-3 text-sm text-muted-foreground">No gaps found.</li>
                    )}
                    {detailQuery.data.gaps.map((gap) => (
                      <li key={gap.id} className="px-5 py-3 text-sm text-foreground">
                        {gap.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  const items = listQuery.data ?? [];

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Saved Analyses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and review your saved editorial analyses.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full min-w-[840px]">
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
              {listQuery.isLoading && (
                <tr>
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={5}>
                    Loading analyses...
                  </td>
                </tr>
              )}

              {!listQuery.isLoading && listQuery.error && (
                <tr>
                  <td className="px-5 py-6 text-sm text-destructive" colSpan={5}>
                    Failed to load analyses.{" "}
                    <button onClick={() => listQuery.refetch()} className="underline">
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {!listQuery.isLoading && !listQuery.error && items.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={5}>
                    No saved analyses found in the database.
                  </td>
                </tr>
              )}

              {!listQuery.isLoading &&
                !listQuery.error &&
                items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-muted/30 ${idx !== items.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground">{item.title}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.category}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${statusColor[item.status.toLowerCase()] ?? statusColor.draft}`}
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/saved/${item.id}`)}
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
