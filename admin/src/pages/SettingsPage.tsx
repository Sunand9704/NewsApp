import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    setProvider(settingsQuery.data.provider || settingsQuery.data.providers[0]?.key || "");
    setModel(settingsQuery.data.model || settingsQuery.data.providers[0]?.models[0]?.key || "");
  }, [settingsQuery.data]);

  const selectedProvider = useMemo(
    () => settingsQuery.data?.providers.find((item) => item.key === provider),
    [settingsQuery.data?.providers, provider],
  );

  const saveMutation = useMutation({
    mutationFn: () => api.updateSettings({ provider, model }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["settings"], updated);
      toast({
        title: "Settings updated",
        description: "Provider and model were saved to the database.",
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

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const providerEntry = settingsQuery.data?.providers.find((item) => item.key === value);
    setModel(providerEntry?.models[0]?.key || "");
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your AI provider and model preferences.
        </p>

        <div className="mt-6 max-w-lg space-y-6">
          {settingsQuery.isLoading && (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground shadow-sm">
              Loading settings...
            </div>
          )}

          {!settingsQuery.isLoading && settingsQuery.error && (
            <div className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive shadow-sm">
              Failed to load settings.{" "}
              <button onClick={() => settingsQuery.refetch()} className="underline">
                Retry
              </button>
            </div>
          )}

          {!settingsQuery.isLoading && !settingsQuery.error && settingsQuery.data && (
            <>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">AI Provider</label>
                  <Select value={provider || undefined} onValueChange={handleProviderChange}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsQuery.data.providers.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Model</label>
                  <Select value={model || undefined} onValueChange={setModel}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProvider?.models.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <label className="text-sm font-medium text-foreground">API Connection Status</label>
                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-success">
                    Active configuration: {provider || "N/A"} / {model || "N/A"}
                  </span>
                </div>
                {settingsQuery.data.updatedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last saved: {new Date(settingsQuery.data.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <Button
                onClick={() => saveMutation.mutate()}
                className="gap-2"
                disabled={saveMutation.isPending || !provider || !model}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
