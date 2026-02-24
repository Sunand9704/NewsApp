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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

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
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your AI provider and model preferences.
          </p>
        </div>

        <div className="max-w-2xl space-y-6">
          {settingsQuery.isLoading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Loading settings...</p>
              </CardContent>
            </Card>
          )}

          {!settingsQuery.isLoading && settingsQuery.error && (
            <Card className="border-destructive/30">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">
                  Failed to load settings.{" "}
                  <button onClick={() => settingsQuery.refetch()} className="underline font-medium">
                    Retry
                  </button>
                </p>
              </CardContent>
            </Card>
          )}

          {!settingsQuery.isLoading && !settingsQuery.error && settingsQuery.data && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Configuration</CardTitle>
                  <CardDescription>
                    Select the preferred AI engine for content generation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">AI Provider</Label>
                    <Select value={provider || undefined} onValueChange={handleProviderChange}>
                      <SelectTrigger id="provider">
                        <SelectValue placeholder="Select provider" />
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

                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Select value={model || undefined} onValueChange={setModel}>
                      <SelectTrigger id="model">
                        <SelectValue placeholder="Select model" />
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
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">System Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Active: {provider || "N/A"} / {model || "N/A"}
                    </span>
                  </div>
                  {settingsQuery.data.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last synchronized: {new Date(settingsQuery.data.updatedAt).toLocaleString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate()}
                  className="gap-2 px-8"
                  disabled={saveMutation.isPending || !provider || !model}
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
