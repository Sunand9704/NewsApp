package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"nanoheads/prompts"
)

const (
	defaultGroqModel   = "llama-3.3-70b-versatile"
	defaultGroqBaseURL = "https://api.groq.com/openai/v1"
	defaultOpenAIModel = "gpt-4o-mini"
	defaultOpenAIURL   = "https://api.openai.com/v1"
)

type OpenAIService struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
}

type chatCompletionRequest struct {
	Model          string          `json:"model"`
	Messages       []chatMessage   `json:"messages"`
	Temperature    float64         `json:"temperature,omitempty"`
	ResponseFormat *responseFormat `json:"response_format,omitempty"`
	MaxTokens      int             `json:"max_tokens,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type responseFormat struct {
	Type string `json:"type"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

type factsOutput struct {
	Facts []string `json:"facts"`
}

type gapsOutput struct {
	Gaps []string `json:"gaps"`
}

type articleOutput struct {
	Article string `json:"article"`
}

type apiRequestError struct {
	StatusCode int
	Message    string
}

func (e *apiRequestError) Error() string {
	return fmt.Sprintf("groq request failed (%d): %s", e.StatusCode, e.Message)
}

func NewOpenAIService() *OpenAIService {
	model := firstNonEmptyEnv("GROQ_MODEL", "OPENAI_MODEL")
	if model == "" {
		model = defaultGroqModel
	}

	baseURL := firstNonEmptyEnv("GROQ_BASE_URL", "OPENAI_BASE_URL")
	if baseURL == "" {
		baseURL = defaultGroqBaseURL
	}

	apiKey := firstNonEmptyEnv("GROQ_API_KEY", "OPENAI_API_KEY")

	return &OpenAIService{
		apiKey:  apiKey,
		model:   model,
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func (s *OpenAIService) ApplySettings(provider string, model string) {
	cleanProvider := strings.ToLower(strings.TrimSpace(provider))
	cleanModel := strings.TrimSpace(model)

	if cleanModel != "" {
		s.model = cleanModel
	}

	switch cleanProvider {
	case "openai":
		apiKey := strings.TrimSpace(os.Getenv("OPENAI_API_KEY"))
		baseURL := strings.TrimSpace(os.Getenv("OPENAI_BASE_URL"))
		if baseURL == "" {
			baseURL = defaultOpenAIURL
		}
		if s.model == "" {
			s.model = defaultOpenAIModel
		}
		s.apiKey = apiKey
		s.baseURL = strings.TrimRight(baseURL, "/")
	default:
		apiKey := firstNonEmptyEnv("GROQ_API_KEY", "OPENAI_API_KEY")
		baseURL := firstNonEmptyEnv("GROQ_BASE_URL", "OPENAI_BASE_URL")
		if baseURL == "" {
			baseURL = defaultGroqBaseURL
		}
		if s.model == "" {
			s.model = defaultGroqModel
		}
		s.apiKey = apiKey
		s.baseURL = strings.TrimRight(baseURL, "/")
	}
}

func (s *OpenAIService) ExtractFacts(ctx context.Context, text string, language string) ([]string, error) {
	clean := strings.TrimSpace(text)
	if clean == "" {
		return nil, errors.New("input text is empty")
	}
	if s.apiKey == "" {
		return nil, errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}

	systemPrompt := fmt.Sprintf(
		"You are a strict fact extraction engine. Return only facts explicitly present in the input. No hallucination. Output language must be %s.",
		language,
	)
	userPrompt := prompts.BuildFactsPrompt(clean) + languageConstraint(language)

	rawJSON, err := s.callJSONCompletion(ctx, "extract-facts", systemPrompt, userPrompt, 0.1, 700)
	if err != nil {
		return nil, err
	}

	var out factsOutput
	if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
		return nil, fmt.Errorf("parse facts response: %w", err)
	}

	deduped := dedupeAndTrim(out.Facts)
	if len(deduped) == 0 {
		return nil, errors.New("groq returned empty facts")
	}

	return deduped, nil
}

func (s *OpenAIService) GenerateGapQuestions(ctx context.Context, text string, facts []string, language string) ([]string, error) {
	if s.apiKey == "" {
		return nil, errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}
	if len(facts) == 0 {
		return nil, errors.New("facts are required to generate gaps")
	}

	joinedFacts := strings.Join(facts, "\n- ")
	userPrompt := prompts.BuildGapsPrompt(fmt.Sprintf("Text:\n%s\n\nFacts:\n- %s", text, joinedFacts)) + languageConstraint(language)
	systemPrompt := fmt.Sprintf(
		"You identify missing verification context. Return practical unanswered questions only. Output language must be %s.",
		language,
	)

	rawJSON, err := s.callJSONCompletion(ctx, "generate-gaps", systemPrompt, userPrompt, 0.2, 700)
	if err != nil {
		return nil, err
	}

	var out gapsOutput
	if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
		return nil, fmt.Errorf("parse gaps response: %w", err)
	}

	deduped := dedupeAndTrim(out.Gaps)
	if len(deduped) == 0 {
		return nil, errors.New("groq returned empty gaps")
	}

	return deduped, nil
}

func (s *OpenAIService) GenerateStructuredArticle(ctx context.Context, facts []string, gaps []string, language string) (string, error) {
	if s.apiKey == "" {
		return "", errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}
	if len(facts) == 0 {
		return "", errors.New("facts are required to generate article")
	}

	factsBlock := "- " + strings.Join(facts, "\n- ")
	gapsBlock := ""
	if len(gaps) > 0 {
		gapsBlock = "- " + strings.Join(gaps, "\n- ")
	}

	systemPrompt := fmt.Sprintf(
		"You write a concise structured article paragraph using only provided facts. Keep uncertain points as open context. Output language must be %s.",
		language,
	)
	userPrompt := prompts.BuildArticlePrompt(factsBlock, gapsBlock) + languageConstraint(language)

	rawJSON, err := s.callJSONCompletion(ctx, "generate-article", systemPrompt, userPrompt, 0.3, 1200)
	if err != nil {
		return "", err
	}

	var out articleOutput
	if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
		return "", fmt.Errorf("parse article response: %w", err)
	}

	article := strings.TrimSpace(out.Article)
	if article == "" {
		return "", errors.New("groq returned empty article")
	}

	return article, nil
}

func (s *OpenAIService) callJSONCompletion(
	ctx context.Context,
	step string,
	systemPrompt string,
	userPrompt string,
	temperature float64,
	maxTokens int,
) (string, error) {
	content, err := s.callCompletion(ctx, step, systemPrompt, userPrompt, temperature, maxTokens, true)
	if err != nil {
		var apiErr *apiRequestError
		if errors.As(err, &apiErr) && shouldRetryWithoutJSONMode(apiErr.Message) {
			log.Printf("[groq][%s] retrying without response_format json_object", step)
			content, err = s.callCompletion(ctx, step, systemPrompt, userPrompt, temperature, maxTokens, false)
		}
	}
	if err != nil {
		return "", err
	}

	cleanJSON := stripCodeFence(content)
	if !json.Valid([]byte(cleanJSON)) {
		return "", errors.New("groq did not return valid json")
	}

	return cleanJSON, nil
}

func (s *OpenAIService) callCompletion(
	ctx context.Context,
	step string,
	systemPrompt string,
	userPrompt string,
	temperature float64,
	maxTokens int,
	useJSONFormat bool,
) (string, error) {
	requestBody := chatCompletionRequest{
		Model: s.model,
		Messages: []chatMessage{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: userPrompt,
			},
		},
		Temperature: temperature,
		MaxTokens:   maxTokens,
	}

	if useJSONFormat {
		requestBody.ResponseFormat = &responseFormat{Type: "json_object"}
	}

	payload, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("marshal groq request: %w", err)
	}

	log.Printf("[groq][%s] model=%s", step, s.model)
	log.Printf("[groq][%s] system prompt:\n%s", step, previewForLog(systemPrompt))
	log.Printf("[groq][%s] user prompt:\n%s", step, previewForLog(userPrompt))

	endpoint := s.baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("build groq request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call groq: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read groq response: %w", err)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		message := extractErrorMessage(body)
		return "", &apiRequestError{
			StatusCode: resp.StatusCode,
			Message:    message,
		}
	}

	var out chatCompletionResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return "", fmt.Errorf("parse groq response body: %w", err)
	}

	if len(out.Choices) == 0 {
		return "", errors.New("groq returned no choices")
	}

	content := strings.TrimSpace(out.Choices[0].Message.Content)
	log.Printf("[groq][%s] raw response:\n%s", step, previewForLog(content))

	return content, nil
}

func dedupeAndTrim(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{})

	for _, value := range values {
		clean := strings.TrimSpace(value)
		if clean == "" {
			continue
		}
		key := strings.ToLower(clean)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, clean)
	}

	return result
}

func stripCodeFence(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}

func previewForLog(value string) string {
	const maxRunes = 2500
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes]) + fmt.Sprintf("\n... [truncated, total_runes=%d]", len(runes))
}

func firstNonEmptyEnv(keys ...string) string {
	for _, key := range keys {
		value := strings.TrimSpace(os.Getenv(key))
		if value != "" {
			return value
		}
	}
	return ""
}

func shouldRetryWithoutJSONMode(message string) bool {
	lower := strings.ToLower(message)
	return strings.Contains(lower, "response_format") || strings.Contains(lower, "json_object")
}

func extractErrorMessage(body []byte) string {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return string(body)
	}

	if errorValue, ok := payload["error"]; ok {
		switch v := errorValue.(type) {
		case map[string]any:
			if msg, ok := v["message"].(string); ok && strings.TrimSpace(msg) != "" {
				return msg
			}
		case string:
			if strings.TrimSpace(v) != "" {
				return v
			}
		}
	}

	if msg, ok := payload["message"].(string); ok && strings.TrimSpace(msg) != "" {
		return msg
	}

	return string(body)
}

func languageConstraint(language string) string {
	return fmt.Sprintf("\n\nImportant: Return every output item strictly in %s language.", language)
}
