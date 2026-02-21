import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { FilePenLine } from "lucide-react";
import { api } from "@/lib/api";

const DraftArticles = () => {
  const navigate = useNavigate();
  const listQuery = useQuery({
    queryKey: ["analyses"],
    queryFn: () => api.listAnalyses(200),
  });

  const drafts = useMemo(() => {
    const items = listQuery.data ?? [];
    return items.filter((item) => item.status.toLowerCase() === "draft");
  }, [listQuery.data]);

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Draft Articles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Simple draft list. Click edit to open the write + metadata step.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Headline</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Topic</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Edit</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && (
                <tr>
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={4}>
                    Loading drafts...
                  </td>
                </tr>
              )}

              {!listQuery.isLoading && listQuery.error && (
                <tr>
                  <td className="px-5 py-6 text-sm text-destructive" colSpan={4}>
                    Failed to load drafts.{" "}
                    <button onClick={() => listQuery.refetch()} className="underline">
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {!listQuery.isLoading && !listQuery.error && drafts.length === 0 && (
                <tr>
                  <td className="px-5 py-6 text-sm text-muted-foreground" colSpan={4}>
                    No draft articles yet.
                  </td>
                </tr>
              )}

              {!listQuery.isLoading &&
                !listQuery.error &&
                drafts.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-muted/30 ${idx !== drafts.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <td className="px-5 py-3.5 text-sm font-medium text-foreground">{item.title}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">{item.category}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/new-analysis/${item.id}?step=4`)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <FilePenLine className="mr-1.5 h-3.5 w-3.5" />
                        Edit
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

export default DraftArticles;
