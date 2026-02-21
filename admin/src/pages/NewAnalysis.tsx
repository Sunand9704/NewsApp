import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  RotateCcw,
  Save,
  Pencil,
  Lightbulb,
  FileText,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type OutputLanguage = "English" | "Telugu";

const NewAnalysis = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [articleText, setArticleText] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>("English");
  const [analysisID, setAnalysisID] = useState<number | null>(null);
  const [editingID, setEditingID] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", analysisID],
    queryFn: () => api.getAnalysis(analysisID as number),
    enabled: analysisID !== null,
  });

  useEffect(() => {
    if (
      analysisQuery.data?.category &&
      analysisQuery.data.category !== "Uncategorized" &&
      !category
    ) {
      setCategory(analysisQuery.data.category);
    }
  }, [analysisQuery.data?.category, category]);

  const analyseMutation = useMutation({
    mutationFn: (payload: {
      url?: string;
      text?: string;
      category?: string;
      language?: OutputLanguage;
    }) =>
      api.analyseArticle(payload),
    onSuccess: (result) => {
      setAnalysisID(result.articleId);
      if (result.language === "English" || result.language === "Telugu") {
        setLanguage(result.language);
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      toast({
        title: "Analysis completed",
        description: `Loaded analysis #${result.articleId} from database.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFactMutation = useMutation({
    mutationFn: (params: {
      factID: number;
      payload: { text?: string; included?: boolean; confirmed?: boolean };
    }) => api.updateFact(params.factID, params.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisID] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Fact update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateGapMutation = useMutation({
    mutationFn: (params: { gapID: number; payload: { text?: string; selected?: boolean } }) =>
      api.updateGap(params.gapID, params.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisID] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Gap update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addFactMutation = useMutation({
    mutationFn: (text: string) => api.addFact(analysisID as number, text),
    onSuccess: (result) => {
      setEditingID(result.id);
      setEditText("New fact...");
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisID] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "Fact added",
        description: "A new fact row was added to the database.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Add fact failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.updateAnalysis(analysisID as number, {
        status: "completed",
        category: category || undefined,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["analysis", analysisID], result);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      toast({
        title: "Saved",
        description: "Analysis status updated to completed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const facts = analysisQuery.data?.facts ?? [];
  const gaps = analysisQuery.data?.gaps ?? [];
  const isAnalysed = analysisID !== null;

  const handleAnalyse = () => {
    const cleanURL = url.trim();
    const cleanText = articleText.trim();

    if (!cleanURL && !cleanText) {
      toast({
        title: "Input required",
        description: "Provide either article URL or article text.",
        variant: "destructive",
      });
      return;
    }

    analyseMutation.mutate({
      url: cleanURL || undefined,
      text: cleanText || undefined,
      category: category || undefined,
      language,
    });
  };

  const toggleFact = (factID: number, included: boolean) => {
    updateFactMutation.mutate({
      factID,
      payload: { included: !included },
    });
  };

  const toggleGap = (gapID: number, selected: boolean) => {
    updateGapMutation.mutate({
      gapID,
      payload: { selected: !selected },
    });
  };

  const startEdit = (fact: { id: number; text: string }) => {
    setEditingID(fact.id);
    setEditText(fact.text);
  };

  const saveEdit = (factID: number) => {
    const clean = editText.trim();
    if (clean === "") {
      toast({
        title: "Fact text required",
        description: "Fact text cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    updateFactMutation.mutate(
      {
        factID,
        payload: { text: clean },
      },
      {
        onSuccess: () => {
          setEditingID(null);
        },
      },
    );
  };

  const addFact = () => {
    if (!analysisID) {
      return;
    }
    addFactMutation.mutate("New fact...");
  };

  const rerunAI = () => {
    if (!analysisQuery.data) {
      return;
    }

    analyseMutation.mutate({
      text: analysisQuery.data.rawText,
      category: category || undefined,
      language,
    });
  };

  const isBusy =
    analyseMutation.isPending ||
    updateFactMutation.isPending ||
    updateGapMutation.isPending ||
    addFactMutation.isPending ||
    confirmMutation.isPending;

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">New Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a URL or article text to extract verifiable facts.
        </p>

        {!isAnalysed && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <label className="text-sm font-medium text-foreground">Article URL</label>
              <div className="mt-2 flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/article..."
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <label className="text-sm font-medium text-foreground">Paste Article Text</label>
              <Textarea
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                placeholder="Paste the full article text here..."
                className="mt-2 min-h-[160px] resize-none"
              />
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-52">
                <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
                <Select value={category || undefined} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesQuery.data?.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <label className="mb-2 block text-sm font-medium text-foreground">Language</label>
                <Select value={language} onValueChange={(value) => setLanguage(value as OutputLanguage)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Telugu">Telugu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAnalyse} className="h-10 px-6" disabled={analyseMutation.isPending}>
                <Search className="mr-2 h-4 w-4" />
                {analyseMutation.isPending ? "Analysing..." : "Analyse"}
              </Button>
            </div>
          </div>
        )}

        {isAnalysed && (
          <div className="mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnalysisID(null)}
              className="mb-4 text-muted-foreground"
            >
              Back to input
            </Button>

            {analysisQuery.isLoading && (
              <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
                Loading analysis data...
              </div>
            )}

            {!analysisQuery.isLoading && analysisQuery.error && (
              <div className="rounded-xl border border-destructive/40 bg-card p-5 text-sm text-destructive shadow-sm">
                Failed to load analysis from database.{" "}
                <button className="underline" onClick={() => analysisQuery.refetch()}>
                  Retry
                </button>
              </div>
            )}

            {!analysisQuery.isLoading && !analysisQuery.error && analysisQuery.data && (
              <>
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Extracted Facts</h3>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {facts.filter((f) => f.included).length}/{facts.length} selected
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {facts.length === 0 && (
                        <div className="px-5 py-4 text-sm text-muted-foreground">No facts generated.</div>
                      )}
                      {facts.map((fact) => (
                        <div
                          key={fact.id}
                          className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={fact.included}
                            onCheckedChange={() => toggleFact(fact.id, fact.included)}
                            className="mt-0.5"
                          />
                          {editingID === fact.id ? (
                            <Input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onBlur={() => saveEdit(fact.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveEdit(fact.id);
                                }
                              }}
                              className="h-8 flex-1 text-sm"
                              autoFocus
                            />
                          ) : (
                            <span
                              className={`flex-1 text-sm ${
                                fact.included ? "text-foreground" : "text-muted-foreground line-through"
                              }`}
                            >
                              {fact.text}
                            </span>
                          )}
                          {editingID !== fact.id && (
                            <button
                              onClick={() => startEdit(fact)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border px-5 py-3">
                      <Button variant="ghost" size="sm" onClick={addFact} className="text-primary">
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Add fact
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-warning" />
                        <h3 className="text-sm font-semibold text-foreground">Gap Suggestions</h3>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {gaps.filter((g) => g.selected).length}/{gaps.length} selected
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {gaps.length === 0 && (
                        <div className="px-5 py-4 text-sm text-muted-foreground">No gap suggestions generated.</div>
                      )}
                      {gaps.map((gap) => (
                        <div
                          key={gap.id}
                          className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={gap.selected}
                            onCheckedChange={() => toggleGap(gap.id, gap.selected)}
                            className="mt-0.5"
                          />
                          <span
                            className={`flex-1 text-sm ${
                              gap.selected ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {gap.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="sticky bottom-0 mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="w-full sm:w-52">
                    <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
                    <Select value={category || undefined} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesQuery.data?.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    </div>
                    <div className="w-full sm:w-44">
                      <label className="mb-2 block text-sm font-medium text-foreground">Language</label>
                      <Select value={language} onValueChange={(value) => setLanguage(value as OutputLanguage)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Telugu">Telugu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2" onClick={rerunAI} disabled={isBusy}>
                      <RotateCcw className="h-4 w-4" />
                      Re-run AI
                    </Button>
                    <Button className="gap-2" onClick={() => confirmMutation.mutate()} disabled={isBusy}>
                      <Save className="h-4 w-4" />
                      {confirmMutation.isPending ? "Saving..." : "Confirm & Save"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NewAnalysis;
