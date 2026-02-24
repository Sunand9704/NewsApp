import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { FilePenLine } from "lucide-react";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

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
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Draft Articles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Simple draft list. Click edit to open the write + metadata step.
          </p>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%]">Headline</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Loading drafts...
                    </TableCell>
                  </TableRow>
                )}

                {!listQuery.isLoading && listQuery.error && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-destructive">
                      Failed to load drafts.{" "}
                      <button onClick={() => listQuery.refetch()} className="underline font-medium">
                        Retry
                      </button>
                    </TableCell>
                  </TableRow>
                )}

                {!listQuery.isLoading && !listQuery.error && drafts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      No draft articles yet.
                    </TableCell>
                  </TableRow>
                )}

                {!listQuery.isLoading &&
                  !listQuery.error &&
                  drafts.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/new-analysis/${item.id}?step=4`)}
                          className="h-8 px-2 lg:px-3"
                        >
                          <FilePenLine className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DraftArticles;
