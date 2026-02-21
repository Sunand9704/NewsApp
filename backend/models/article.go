package models

import "time"

type Article struct {
	ID        int64     `json:"id,omitempty"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Verdict   string    `json:"verdict,omitempty"`
	CreatedAt time.Time `json:"created_at,omitempty"`
}

type PhaseOneInput struct {
	Text     string `json:"text,omitempty"`
	URL      string `json:"url,omitempty"`
	Language string `json:"language,omitempty"`
	Category string `json:"category,omitempty"`
}

type PhaseOneResponse struct {
	ArticleID int64    `json:"articleId"`
	Language  string   `json:"language"`
	Facts     []string `json:"facts"`
	Gaps      []string `json:"gaps"`
	Article   string   `json:"article"`
}
