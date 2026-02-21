package models

import "time"

type DashboardSummary struct {
	TotalAnalyses int64  `json:"totalAnalyses"`
	PendingReview int64  `json:"pendingReview"`
	SavedArticles int64  `json:"savedArticles"`
	AIUsagePct    int64  `json:"aiUsagePct"`
	AIUsageText   string `json:"aiUsageText"`
}

type DashboardResponse struct {
	Summary        DashboardSummary   `json:"summary"`
	RecentAnalyses []AnalysisListItem `json:"recentAnalyses"`
}

type AnalysisListItem struct {
	ID        int64     `json:"id"`
	Title     string    `json:"title"`
	Category  string    `json:"category"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type AnalysisFact struct {
	ID        int64  `json:"id"`
	Text      string `json:"text"`
	Included  bool   `json:"included"`
	Confirmed bool   `json:"confirmed"`
	Source    string `json:"source"`
}

type AnalysisGap struct {
	ID       int64  `json:"id"`
	Text     string `json:"text"`
	Selected bool   `json:"selected"`
	Resolved bool   `json:"resolved"`
}

type AnalysisDetail struct {
	ID          int64          `json:"id"`
	Title       string         `json:"title"`
	Category    string         `json:"category"`
	Status      string         `json:"status"`
	SourceURL   string         `json:"sourceUrl"`
	RawText     string         `json:"rawText"`
	ArticleText string         `json:"articleText"`
	CreatedAt   time.Time      `json:"createdAt"`
	Facts       []AnalysisFact `json:"facts"`
	Gaps        []AnalysisGap  `json:"gaps"`
}

type ModelOption struct {
	ID        int64  `json:"id"`
	Key       string `json:"key"`
	Name      string `json:"name"`
	IsDefault bool   `json:"isDefault"`
}

type ProviderOption struct {
	ID     int64         `json:"id"`
	Key    string        `json:"key"`
	Name   string        `json:"name"`
	Models []ModelOption `json:"models"`
}

type SettingsResponse struct {
	Provider  string           `json:"provider"`
	Model     string           `json:"model"`
	UpdatedAt time.Time        `json:"updatedAt"`
	Providers []ProviderOption `json:"providers"`
}
