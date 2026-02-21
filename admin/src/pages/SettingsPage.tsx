import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, XCircle, Save } from "lucide-react";

const SettingsPage = () => {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [saved, setSaved] = useState(false);

  const models: Record<string, string[]> = {
    openai: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    groq: ["llama-3.3-70b", "mixtral-8x7b", "gemma2-9b"],
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your AI provider and model preferences.
        </p>

        <div className="mt-6 max-w-lg space-y-6">
          {/* Provider */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">AI Provider</label>
              <Select
                value={provider}
                onValueChange={(val) => {
                  setProvider(val);
                  setModel(models[val][0]);
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Model</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models[provider].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Connection Status */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <label className="text-sm font-medium text-foreground">API Connection Status</label>
            <div className="mt-3 flex items-center gap-2">
              {provider === "openai" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">Connected — OpenAI API</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">Not connected — Add API key</span>
                </>
              )}
            </div>
          </div>

          {/* Save */}
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : "Save Settings"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
