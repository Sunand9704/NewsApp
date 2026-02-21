const localhost = "https://newsapp-backend-42q6.onrender.com/api";

export interface AnalyseResponse {
  articleId: number;
  language: string;
  facts: string[];
  gaps: string[];
  article: string;
}

export interface DashboardSummary {
  totalAnalyses: number;
  pendingReview: number;
  savedArticles: number;
  aiUsagePct: number;
  aiUsageText: string;
}

export interface AnalysisListItem {
  id: number;
  title: string;
  category: string;
  status: string;
  createdAt: string;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  recentAnalyses: AnalysisListItem[];
}

export interface AnalysisFact {
  id: number;
  text: string;
  included: boolean;
  confirmed: boolean;
  source: string;
}

export interface AnalysisGap {
  id: number;
  text: string;
  selected: boolean;
  resolved: boolean;
}

export interface AnalysisDetail {
  id: number;
  title: string;
  category: string;
  status: string;
  sourceUrl: string;
  rawText: string;
  selectedFormat: string;
  articleText: string;
  headlineSelected: string;
  straplineSelected: string;
  headlineOptions: string[];
  straplineOptions: string[];
  slug: string;
  metaDescription: string;
  excerpt: string;
  createdAt: string;
  facts: AnalysisFact[];
  gaps: AnalysisGap[];
}

export interface ModelOption {
  id: number;
  key: string;
  name: string;
  isDefault: boolean;
}

export interface ProviderOption {
  id: number;
  key: string;
  name: string;
  models: ModelOption[];
}

export interface SettingsResponse {
  provider: string;
  model: string;
  updatedAt: string;
  providers: ProviderOption[];
}

interface AnalysePayload {
  url?: string;
  text?: string;
  content?: string;
  language?: string;
  category?: string;
}

interface UpdateFactPayload {
  text?: string;
  included?: boolean;
  confirmed?: boolean;
}

interface UpdateGapPayload {
  text?: string;
  selected?: boolean;
  resolved?: boolean;
}

export interface UpdateAnalysisPayload {
  status?: "draft" | "pending" | "completed";
  category?: string;
  selectedFormat?: string;
  articleText?: string;
  headlineSelected?: string;
  straplineSelected?: string;
  slug?: string;
  metaDescription?: string;
  excerpt?: string;
}

interface UpdateSettingsPayload {
  provider: string;
  model: string;
}

const apiBaseURL = (import.meta.env.VITE_API_BASE_URL || localhost).replace(/\/+$/, "");

function buildURL(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseURL}${cleanPath}`;
}

function compactPayload<T extends Record<string, unknown>>(payload: T): T {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null),
  ) as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? "GET").toUpperCase();
  const hasBody = init?.body !== undefined && init?.body !== null;
  const shouldSendJSONContentType =
    hasBody && method !== "GET" && method !== "HEAD" && !(init?.body instanceof FormData);

  if (shouldSendJSONContentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildURL(path), {
    ...init,
    headers,
  });

  const raw = await response.text();
  let payload: unknown = null;
  if (raw.trim() !== "") {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    if (typeof payload === "object" && payload !== null && "error" in payload) {
      throw new Error(String((payload as { error?: unknown }).error ?? "Request failed"));
    }
    throw new Error(`Request failed (${response.status})`);
  }

  return payload as T;
}

export const api = {
  async analyseArticle(payload: AnalysePayload): Promise<AnalyseResponse> {
    return request<AnalyseResponse>("/analyse", {
      method: "POST",
      body: JSON.stringify(compactPayload(payload)),
    });
  },

  async getDashboard(limit = 5): Promise<DashboardResponse> {
    return request<DashboardResponse>(`/dashboard?limit=${limit}`);
  },

  async listAnalyses(limit = 100): Promise<AnalysisListItem[]> {
    const response = await request<{ items: AnalysisListItem[] }>(`/analyses?limit=${limit}`);
    return response.items;
  },

  async getAnalysis(analysisID: number): Promise<AnalysisDetail> {
    return request<AnalysisDetail>(`/analyses/${analysisID}`);
  },

  async updateAnalysis(analysisID: number, payload: UpdateAnalysisPayload): Promise<AnalysisDetail> {
    return request<AnalysisDetail>(`/analyses/${analysisID}`, {
      method: "PATCH",
      body: JSON.stringify(compactPayload(payload)),
    });
  },

  async addFact(analysisID: number, text: string): Promise<{ id: number }> {
    return request<{ id: number }>(`/analyses/${analysisID}/facts`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  async updateFact(factID: number, payload: UpdateFactPayload): Promise<void> {
    await request<{ status: string }>(`/facts/${factID}`, {
      method: "PATCH",
      body: JSON.stringify(compactPayload(payload)),
    });
  },

  async deleteFact(factID: number): Promise<void> {
    await request<{ status: string }>(`/facts/${factID}`, {
      method: "DELETE",
    });
  },

  async updateGap(gapID: number, payload: UpdateGapPayload): Promise<void> {
    await request<{ status: string }>(`/gaps/${gapID}`, {
      method: "PATCH",
      body: JSON.stringify(compactPayload(payload)),
    });
  },

  async listCategories(): Promise<string[]> {
    const response = await request<{ items: string[] }>("/categories");
    return response.items;
  },

  async getSettings(): Promise<SettingsResponse> {
    return request<SettingsResponse>("/settings");
  },

  async updateSettings(payload: UpdateSettingsPayload): Promise<SettingsResponse> {
    return request<SettingsResponse>("/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};
