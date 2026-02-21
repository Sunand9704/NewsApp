import { useState } from "react";
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

interface Fact {
  id: number;
  text: string;
  included: boolean;
}

interface Gap {
  id: number;
  text: string;
  selected: boolean;
}

const sampleFacts: Fact[] = [
  { id: 1, text: "Loss: ₹487 Cr (Q3 FY26)", included: true },
  { id: 2, text: "Revenue: ₹470 Cr", included: true },
  { id: 3, text: "Stock price low: ₹28.73", included: true },
  { id: 4, text: "Employee count reduced by 4,500", included: false },
  { id: 5, text: "Valuation dropped from $22B to $1.1B", included: true },
];

const sampleGaps: Gap[] = [
  { id: 1, text: "What was the previous quarter loss?", selected: true },
  { id: 2, text: "What is the all-time high stock price?", selected: true },
  { id: 3, text: "How does this compare to competitors?", selected: false },
  { id: 4, text: "What is the company's cash runway?", selected: false },
  { id: 5, text: "What did the management say in the earnings call?", selected: true },
];

const NewAnalysis = () => {
  const [url, setUrl] = useState("");
  const [articleText, setArticleText] = useState("");
  const [category, setCategory] = useState("");
  const [isAnalysed, setIsAnalysed] = useState(false);
  const [facts, setFacts] = useState<Fact[]>(sampleFacts);
  const [gaps, setGaps] = useState<Gap[]>(sampleGaps);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleAnalyse = () => {
    setIsAnalysed(true);
  };

  const toggleFact = (id: number) => {
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, included: !f.included } : f)));
  };

  const toggleGap = (id: number) => {
    setGaps((prev) => prev.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g)));
  };

  const startEdit = (fact: Fact) => {
    setEditingId(fact.id);
    setEditText(fact.text);
  };

  const saveEdit = (id: number) => {
    setFacts((prev) => prev.map((f) => (f.id === id ? { ...f, text: editText } : f)));
    setEditingId(null);
  };

  const addFact = () => {
    const newId = Math.max(...facts.map((f) => f.id)) + 1;
    setFacts([...facts, { id: newId, text: "New fact...", included: true }]);
    setEditingId(newId);
    setEditText("New fact...");
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">New Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a URL or article text to extract verifiable facts.
        </p>

        {/* Input Section */}
        {!isAnalysed && (
          <div className="mt-6 space-y-4">
            {/* URL Input */}
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

            {/* Separator */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">OR</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Text Input */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <label className="text-sm font-medium text-foreground">Paste Article Text</label>
              <Textarea
                value={articleText}
                onChange={(e) => setArticleText(e.target.value)}
                placeholder="Paste the full article text here..."
                className="mt-2 min-h-[160px] resize-none"
              />
            </div>

            {/* Category & Analyse */}
            <div className="flex items-end gap-3">
              <div className="w-48">
                <label className="mb-2 block text-sm font-medium text-foreground">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="politics">Politics</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="science">Science</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAnalyse} className="h-10 px-6">
                <Search className="mr-2 h-4 w-4" />
                Analyse
              </Button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {isAnalysed && (
          <div className="mt-6">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAnalysed(false)}
              className="mb-4 text-muted-foreground"
            >
              ← Back to input
            </Button>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* Left Panel — Fact List */}
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
                  {facts.map((fact) => (
                    <div
                      key={fact.id}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={fact.included}
                        onCheckedChange={() => toggleFact(fact.id)}
                        className="mt-0.5"
                      />
                      {editingId === fact.id ? (
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onBlur={() => saveEdit(fact.id)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit(fact.id)}
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
                      {editingId !== fact.id && (
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

              {/* Right Panel — Gap Suggestions */}
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
                  {gaps.map((gap) => (
                    <div
                      key={gap.id}
                      className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        checked={gap.selected}
                        onCheckedChange={() => toggleGap(gap.id)}
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

            {/* Sticky Bottom Bar */}
            <div className="sticky bottom-0 mt-6 flex items-center justify-end gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
              <Button variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Re-run AI
              </Button>
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Confirm & Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NewAnalysis;
