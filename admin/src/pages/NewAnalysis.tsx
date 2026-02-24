import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type UpdateAnalysisPayload } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  Check,
  FileText,
  Lightbulb,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type OutputLanguage = "English" | "Telugu";
type Step = 1 | 2 | 3 | 4;
type FormatValue = "stat-card" | "table" | "timeline";

interface FormatCard {
  value: FormatValue;
  label: string;
  confidence: number;
  description: string;
  preview: string;
}

const FORMAT_OPTIONS: FormatCard[] = [
  {
    value: "stat-card",
    label: "Stat Card + Paragraph",
    confidence: 52,
    description: "Best for a single dominant number",
    preview: "[ Stat ]  |  One-paragraph summary",
  },
  {
    value: "table",
    label: "Table + Paragraph",
    confidence: 31,
    description: "Best for side-by-side fact comparison",
    preview: "[ Key data table ] + narrative block",
  },
  {
    value: "timeline",
    label: "Timeline + Paragraph",
    confidence: 17,
    description: "Best for cause-effect and sequence",
    preview: "[ Event 1 -> Event 2 -> Event 3 ]",
  },
];

function parseStep(value: string | null): Step {
  if (value === "2") return 2;
  if (value === "3") return 3;
  if (value === "4") return 4;
  return 1;
}

function normalizeFormat(value?: string): FormatValue {
  const clean = String(value ?? "").toLowerCase();
  if (clean.includes("stat")) return "stat-card";
  if (clean.includes("table")) return "table";
  return "timeline";
}

function slugify(value: string | null | undefined): string {
  const cleanValue = String(value ?? "");
  return cleanValue
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clip(value: string | null | undefined, size: number): string {
  const clean = String(value ?? "").trim();
  if (clean.length <= size) return clean;
  return `${clean.slice(0, size - 3)}...`;
}

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  values.forEach((value) => {
    const clean = String(value ?? "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(clean);
  });

  return output;
}

const NewAnalysis = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { analysisId } = useParams();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>(() => parseStep(searchParams.get("step")));
  const [url, setUrl] = useState("");
  const [articleText, setArticleText] = useState("");
  const [category, setCategory] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [language, setLanguage] = useState<OutputLanguage>("English");
  const [analysisID, setAnalysisID] = useState<number | null>(null);

  const [editingID, setEditingID] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const [selectedFormat, setSelectedFormat] = useState<FormatValue>("timeline");
  const [articleDraft, setArticleDraft] = useState("");
  const [headlineOptions, setHeadlineOptions] = useState<string[]>([]);
  const [straplineOptions, setStraplineOptions] = useState<string[]>([]);
  const [selectedHeadline, setSelectedHeadline] = useState("");
  const [selectedStrapline, setSelectedStrapline] = useState("");
  const [newHeadline, setNewHeadline] = useState("");
  const [newStrapline, setNewStrapline] = useState("");
  const [slug, setSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [hydratedAnalysisID, setHydratedAnalysisID] = useState<number | null>(null);

  useEffect(() => {
    const parsed = Number(analysisId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setAnalysisID(null);
      setStep(1);
      return;
    }

    setAnalysisID(parsed);
    setStep(searchParams.has("step") ? parseStep(searchParams.get("step")) : 4);
  }, [analysisId, searchParams]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", analysisID],
    queryFn: () => api.getAnalysis(analysisID as number),
    enabled: analysisID !== null,
  });

  const analyseMutation = useMutation({
    mutationFn: (payload: {
      url?: string;
      text?: string;
      category?: string;
      language?: OutputLanguage;
    }) => api.analyseArticle(payload),
    onSuccess: (result) => {
      setAnalysisID(result.articleId);
      setHydratedAnalysisID(null);
      setStep(2);
      navigate(`/new-analysis/${result.articleId}?step=2`);

      if (result.language === "English" || result.language === "Telugu") {
        setLanguage(result.language);
      }

      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });

      toast({
        title: "Analysis completed",
        description: `Loaded analysis #${result.articleId}.`,
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

  const deleteFactMutation = useMutation({
    mutationFn: (factID: number) => api.deleteFact(factID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisID] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
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
        description: "A new fact row was added.",
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

  const updateAnalysisMutation = useMutation({
    mutationFn: (payload: UpdateAnalysisPayload) => api.updateAnalysis(analysisID as number, payload),
    onSuccess: (result) => {
      queryClient.setQueryData(["analysis", analysisID], result);
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisID] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!analysisID || !analysisQuery.data || hydratedAnalysisID === analysisID) return;

    const data = analysisQuery.data;

    if (data.category && data.category !== "Uncategorized") {
      setCategory(data.category);
    }

    setSelectedFormat(normalizeFormat(data.selectedFormat));
    setArticleDraft(data.articleText || "");

    const backendHeadlines = unique(data.headlineOptions ?? []);
    const backendStraplines = unique(data.straplineOptions ?? []);

    const includedFacts = data.facts.filter((fact) => fact.included).map((fact) => clip(fact.text, 90));
    const selectedGaps = data.gaps.filter((gap) => gap.selected).map((gap) => clip(gap.text, 80));

    const fallbackHeadline = clip(data.title || `Analysis ${data.id}`, 90);
    const fallbackHeadlines = unique([
      data.headlineSelected,
      fallbackHeadline,
      ...includedFacts,
      `${fallbackHeadline} - Key Facts`,
    ]);

    const fallbackStrapline = clip(
      data.category && data.category !== "Uncategorized"
        ? `${data.category} update with verified data points`
        : "Verified breakdown from extracted facts",
      90,
    );
    const fallbackStraplines = unique([
      data.straplineSelected,
      fallbackStrapline,
      ...selectedGaps.map((item) => `Why this matters: ${item}`),
    ]);

    const nextHeadlines = backendHeadlines.length > 0 ? backendHeadlines : fallbackHeadlines;
    const nextStraplines = backendStraplines.length > 0 ? backendStraplines : fallbackStraplines;

    setHeadlineOptions(nextHeadlines);
    setStraplineOptions(nextStraplines);
    setSelectedHeadline(data.headlineSelected || nextHeadlines[0] || "");
    setSelectedStrapline(data.straplineSelected || nextStraplines[0] || "");

    const fallbackSlug = slugify(data.headlineSelected || nextHeadlines[0] || data.title);
    setSlug(data.slug || fallbackSlug);
    setMetaDescription(data.metaDescription || clip(data.articleText || data.rawText, 155));
    setExcerpt(data.excerpt || clip(data.articleText || data.rawText, 180));

    setHydratedAnalysisID(analysisID);
  }, [analysisID, analysisQuery.data, hydratedAnalysisID]);

  const facts = analysisQuery.data?.facts ?? [];
  const gaps = analysisQuery.data?.gaps ?? [];

  const includedFactsCount = useMemo(() => facts.filter((fact) => fact.included).length, [facts]);

  const isBusy =
    analyseMutation.isPending ||
    updateFactMutation.isPending ||
    deleteFactMutation.isPending ||
    updateGapMutation.isPending ||
    addFactMutation.isPending ||
    updateAnalysisMutation.isPending;

  const canOpenStep = (value: Step) => {
    if (value === 1) return true;
    return analysisID !== null;
  };

  const moveToStep = (value: Step) => {
    if (!canOpenStep(value)) return;

    setStep(value);

    if (analysisID) {
      navigate(`/new-analysis/${analysisID}?step=${value}`);
      return;
    }

    navigate("/new-analysis");
  };

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
    updateFactMutation.mutate({ factID, payload: { included: !included } });
  };

  const toggleGap = (gapID: number, selected: boolean) => {
    updateGapMutation.mutate({ gapID, payload: { selected: !selected } });
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
      { factID, payload: { text: clean } },
      { onSuccess: () => setEditingID(null) },
    );
  };

  const addFact = () => {
    if (!analysisID) return;
    addFactMutation.mutate("New fact...");
  };

  const deleteFact = (factID: number) => {
    deleteFactMutation.mutate(factID);
  };

  const rerunAI = () => {
    if (!analysisQuery.data) return;

    analyseMutation.mutate({
      text: analysisQuery.data.rawText,
      category: category || undefined,
      language,
    });
  };

  const confirmFacts = () => {
    if (!analysisID) return;
    moveToStep(3);
  };

  const continueToWriter = () => {
    if (!analysisID) return;

    updateAnalysisMutation.mutate(
      { selectedFormat, status: "pending" },
      { onSuccess: () => moveToStep(4) },
    );
  };

  const addCustomHeadline = () => {
    const clean = newHeadline.trim();
    if (!clean) return;
    setHeadlineOptions((current) => unique([clean, ...current]));
    setSelectedHeadline(clean);
    setNewHeadline("");
  };

  const addCustomStrapline = () => {
    const clean = newStrapline.trim();
    if (!clean) return;
    setStraplineOptions((current) => unique([clean, ...current]));
    setSelectedStrapline(clean);
    setNewStrapline("");
  };

  const applyCustomTopic = () => {
    const clean = customTopic.trim();
    if (!clean) return;
    setCategory(clean);
    setCustomTopic("");
  };

  const saveDraft = () => {
    if (!analysisID) return;

    updateAnalysisMutation.mutate(
      {
        status: "draft",
        category: category || undefined,
        selectedFormat,
        articleText: articleDraft,
        headlineSelected: selectedHeadline || undefined,
        straplineSelected: selectedStrapline || undefined,
        slug: slug || undefined,
        metaDescription: metaDescription || undefined,
        excerpt: excerpt || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "Draft saved",
            description: "Article draft and metadata were saved.",
          });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["analyses"] });
        },
      },
    );
  };

  const backToInput = () => {
    setAnalysisID(null);
    setStep(1);
    setHydratedAnalysisID(null);
    navigate("/new-analysis");
  };

  const stepItems: Array<{ id: Step; label: string }> = [
    { id: 1, label: "Input" },
    { id: 2, label: "Facts" },
    { id: 3, label: "Format" },
    { id: 4, label: "Write" },
  ];

  const renderStep1 = () => (
    <div className="mx-auto mt-6 max-w-3xl space-y-4">
      <Card shadow-sm>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Paste article URL</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium text-muted-foreground">OR</span>
        <Separator className="flex-1" />
      </div>

      <Card shadow-sm>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Paste article text</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={articleText}
            onChange={(e) => setArticleText(e.target.value)}
            placeholder="Paste the full article text here"
            className="min-h-[180px] resize-none"
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto]">
        <div>
          <Label className="mb-2 block text-sm font-medium text-foreground">Category</Label>
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

        <div>
          <Label className="mb-2 block text-sm font-medium text-foreground">Language</Label>
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

        <Button onClick={handleAnalyse} className="h-10 self-end px-6" disabled={analyseMutation.isPending}>
          <Search className="mr-2 h-4 w-4" />
          {analyseMutation.isPending ? "Analysing..." : "Analyse"}
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!analysisID) return null;

    if (analysisQuery.isLoading) {
      return (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Loading facts and gaps...</p>
          </CardContent>
        </Card>
      );
    }

    if (analysisQuery.error) {
      return (
        <Card className="mt-6 border-destructive/40">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Failed to load analysis data.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card shadow-sm>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 py-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Confirmed Facts</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                {includedFactsCount}/{facts.length} selected
              </span>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {facts.length === 0 && (
                  <div className="px-5 py-4 text-sm text-muted-foreground text-center">No facts generated.</div>
                )}

                {facts.map((fact) => (
                  <div key={fact.id} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
                    <Checkbox
                      checked={fact.included}
                      onCheckedChange={() => toggleFact(fact.id, fact.included)}
                      className="mt-1"
                    />

                    {editingID === fact.id ? (
                      <Input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => saveEdit(fact.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(fact.id);
                        }}
                        className="h-8 flex-1 text-sm"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={cn(
                          "flex-1 text-sm leading-normal",
                          fact.included ? "text-foreground" : "text-muted-foreground line-through opacity-70",
                        )}
                      >
                        {fact.text}
                      </span>
                    )}

                    {editingID !== fact.id && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => startEdit(fact)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteFact(fact.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <Separator />
            <CardFooter className="px-5 py-3">
              <Button variant="ghost" size="sm" onClick={addFact} className="text-primary hover:text-primary hover:bg-primary/5">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add fact
              </Button>
            </CardFooter>
          </Card>

          <Card shadow-sm>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 py-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning" />
                <CardTitle className="text-sm font-semibold">Missing / Gaps</CardTitle>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                {gaps.filter((gap) => gap.selected).length}/{gaps.length} selected
              </span>
            </CardHeader>
            <Separator />
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {gaps.length === 0 && (
                  <div className="px-5 py-4 text-sm text-muted-foreground text-center">No gap suggestions generated.</div>
                )}

                {gaps.map((gap) => (
                  <div key={gap.id} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
                    <Checkbox
                      checked={gap.selected}
                      onCheckedChange={() => toggleGap(gap.id, gap.selected)}
                      className="mt-1"
                    />
                    <span className="flex-1 text-sm leading-normal text-foreground">{gap.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="sticky bottom-0 z-10 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
          <CardContent className="flex flex-wrap items-center justify-end gap-3 px-5 py-4">
            <Button variant="outline" className="gap-2" onClick={rerunAI} disabled={isBusy}>
              <RotateCcw className="h-4 w-4" />
              Re-run AI analysis
            </Button>
            <Button onClick={confirmFacts} disabled={isBusy || includedFactsCount === 0} className="px-8">
              Confirm & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="mt-6 space-y-6">
      <Card shadow-sm>
        <CardHeader>
          <CardTitle>Article Format</CardTitle>
          <CardDescription>
            Choose the best presentation style for this story.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {FORMAT_OPTIONS.map((option) => {
          const active = selectedFormat === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedFormat(option.value)}
              className={cn(
                "rounded-xl border bg-card p-5 text-left shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{option.label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{option.description}</p>
                </div>
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-[10px] font-bold text-muted-foreground">
                  {option.confidence}%
                </div>
              </div>

              <div className="mt-5 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground font-mono">
                {option.preview}
              </div>

              {active && (
                <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Currently Selected
                </div>
              )}
            </button>
          );
        })}
      </div>

      <Card className="sticky bottom-0 z-10 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <CardContent className="flex items-center justify-between gap-3 px-5 py-4">
          <Button variant="outline" onClick={() => moveToStep(2)}>
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
            Back to Facts
          </Button>
          <Button onClick={continueToWriter} disabled={!selectedFormat || isBusy} className="px-8">
            Start Writing
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep4 = () => {
    if (!analysisID) return null;

    const words = articleDraft.trim() ? articleDraft.trim().split(/\s+/).length : 0;

    return (
      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-muted/5 py-4">
              <div>
                <CardTitle className="text-sm font-medium">Article Draft</CardTitle>
                <CardDescription className="text-xs">
                  Format: {FORMAT_OPTIONS.find((item) => item.value === selectedFormat)?.label}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => moveToStep(3)} className="h-8">
                Change Format
              </Button>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="article-headline" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Headline</Label>
                <Input
                  id="article-headline"
                  value={selectedHeadline}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedHeadline(value);
                    if (!slug.trim()) setSlug(slugify(value));
                  }}
                  placeholder="Primary headline for the article"
                  className="text-lg font-semibold h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="article-editor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content Editor</Label>
                <Textarea
                  id="article-editor"
                  value={articleDraft}
                  onChange={(e) => setArticleDraft(e.target.value)}
                  placeholder="Draft your story here..."
                  className="min-h-[450px] md:min-h-[550px] resize-y leading-relaxed"
                />
              </div>
            </CardContent>
            <Separator />
            <CardFooter className="bg-muted/5 py-3">
              <span className="text-xs font-medium text-muted-foreground">
                Word count: <span className="text-foreground">{words}</span> words
              </span>
            </CardFooter>
          </Card>

          <div className="space-y-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-8.5rem)] xl:overflow-y-auto xl:pr-1">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">1. Headlines</CardTitle>
                <CardDescription className="text-xs">AI suggested options</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedHeadline}
                  onValueChange={setSelectedHeadline}
                  className="space-y-2"
                >
                  {headlineOptions.map((option, index) => {
                    const optionID = `headline-option-${index}`;
                    return (
                      <div key={option} className="flex items-start gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <RadioGroupItem value={option} id={optionID} className="mt-0.5" />
                        <Label
                          htmlFor={optionID}
                          className="text-xs leading-normal font-medium cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>

                <div className="mt-4 flex items-center gap-2">
                  <Input
                    value={newHeadline}
                    onChange={(e) => setNewHeadline(e.target.value)}
                    placeholder="New custom headline..."
                    className="h-9 text-xs"
                  />
                  <Button variant="secondary" size="sm" onClick={addCustomHeadline} className="h-9">
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">2. Straplines</CardTitle>
                <CardDescription className="text-xs">Secondary headlines</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedStrapline}
                  onValueChange={setSelectedStrapline}
                  className="space-y-2"
                >
                  {straplineOptions.map((option, index) => {
                    const optionID = `strapline-option-${index}`;
                    return (
                      <div key={option} className="flex items-start gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <RadioGroupItem value={option} id={optionID} className="mt-0.5" />
                        <Label
                          htmlFor={optionID}
                          className="text-xs leading-normal font-medium cursor-pointer"
                        >
                          {option}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>

                <div className="mt-4 flex items-center gap-2">
                  <Input
                    value={newStrapline}
                    onChange={(e) => setNewStrapline(e.target.value)}
                    placeholder="New custom strapline..."
                    className="h-9 text-xs"
                  />
                  <Button variant="secondary" size="sm" onClick={addCustomStrapline} className="h-9">
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">3. SEO Metadata</CardTitle>
                <CardDescription className="text-xs">Search engine settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">URL Slug</Label>
                  <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meta Description</Label>
                  <Textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    className="min-h-[80px] text-xs resize-none"
                    placeholder="Brief summary for search results"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Excerpt</Label>
                  <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className="min-h-[80px] text-xs resize-none" placeholder="Summary for article listings" />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">4. Classification</CardTitle>
                <CardDescription className="text-xs">Category management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assign Category</Label>
                  <Select value={category || undefined} onValueChange={setCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select classification" />
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

                <div className="flex items-center gap-2 pt-2 border-t mt-2">
                  <Input
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Override topic name"
                    className="h-9 text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={applyCustomTopic} className="h-9">
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="sticky bottom-0 z-20 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
          <CardContent className="flex flex-wrap items-center justify-end gap-3 px-5 py-4">
            <Button variant="outline" onClick={() => navigate("/draft-articles")}>
              Go to Drafts
            </Button>
            <Button onClick={saveDraft} disabled={isBusy} className="px-10">
              Save changes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">New Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              4-step flow: Input - Facts - Format - Write Article.
            </p>
          </div>

          {analysisID && (
            <Button variant="ghost" size="sm" onClick={backToInput} className="text-muted-foreground">
              Start new
            </Button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stepItems.map((item) => {
            const isActive = step === item.id;
            const isEnabled = canOpenStep(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!isEnabled}
                onClick={() => moveToStep(item.id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                  isEnabled ? "hover:border-primary/40 hover:text-foreground" : "cursor-not-allowed opacity-60",
                )}
              >
                <span>{item.id}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {step > 1 && analysisID && analysisQuery.isFetching && (
          <p className="mt-3 text-xs text-muted-foreground">Syncing latest analysis changes...</p>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </DashboardLayout>
  );
};

export default NewAnalysis;
