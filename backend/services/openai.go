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
	"regexp"
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
	provider   string
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

type headlinesOutput struct {
	Headlines []string `json:"headlines"`
}

type straplinesOutput struct {
	Straplines []string `json:"straplines"`
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
		apiKey:   apiKey,
		model:    model,
		baseURL:  strings.TrimRight(baseURL, "/"),
		provider: "groq",
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
		s.provider = "openai"
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
		s.provider = "groq"
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
	currentInput := clean
	var lastErr error

	for attempt := 1; attempt <= 4; attempt++ {
		userPrompt := prompts.BuildFactsPrompt(currentInput) + languageConstraint(language)
		rawJSON, err := s.callJSONCompletion(ctx, "extract-facts", systemPrompt, userPrompt, 0.1, 700)
		if err == nil {
			var out factsOutput
			if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
				return nil, fmt.Errorf("parse facts response: %w", err)
			}

			facts := out.Facts
			if len(facts) == 0 {
				facts = parseFirstStringArrayField(rawJSON, "facts")
			}

			deduped := dedupeAndTrim(facts)
			if len(deduped) == 0 {
				return nil, errors.New("groq returned empty facts")
			}

			return deduped, nil
		}

		if !isRequestTooLargeError(err) {
			return nil, err
		}

		lastErr = err
		shorterInput := shrinkPromptInput(currentInput)
		if shorterInput == currentInput {
			return nil, err
		}

		log.Printf(
			"[groq][extract-facts] request too large, retrying with shorter input (attempt=%d runes_before=%d runes_after=%d)",
			attempt,
			len([]rune(currentInput)),
			len([]rune(shorterInput)),
		)
		currentInput = shorterInput
	}

	if lastErr != nil {
		return nil, lastErr
	}

	return nil, errors.New("extract facts failed after retries")
}

func (s *OpenAIService) GenerateGapQuestions(ctx context.Context, facts []string, language string) ([]string, error) {
	if s.apiKey == "" {
		return nil, errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}
	if len(facts) == 0 {
		return nil, errors.New("facts are required to generate gaps")
	}

	joinedFacts := strings.Join(facts, "\n- ")
	userPrompt := prompts.BuildGapsPrompt(fmt.Sprintf("Facts:\n- %s", joinedFacts)) + languageConstraint(language)
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

	gaps := out.Gaps
	if len(gaps) == 0 {
		gaps = parseFirstStringArrayField(rawJSON, "gaps")
	}

	deduped := dedupeAndTrim(gaps)
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
		article = strings.TrimSpace(parseFirstStringField(rawJSON, "article"))
	}
	if article == "" {
		return "", errors.New("groq returned empty article")
	}

	return article, nil
}

func (s *OpenAIService) GenerateHeadlineOptions(
	ctx context.Context,
	facts []string,
	article string,
	language string,
) ([]string, error) {
	if s.apiKey == "" {
		return nil, errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}

	factsBlock := "- " + strings.Join(dedupeAndTrim(facts), "\n- ")
	articleBlock := truncateForPrompt(article, 900)
	if strings.TrimSpace(factsBlock) == "-" {
		return nil, errors.New("facts are required to generate headlines")
	}

	systemPrompt := fmt.Sprintf(
		"You generate editorial headlines from verified facts only. Output language must be %s.",
		language,
	)
	userPrompt := prompts.BuildHeadlinesPrompt(factsBlock, articleBlock) + languageConstraint(language)

	rawJSON, err := s.callJSONCompletion(ctx, "generate-headlines", systemPrompt, userPrompt, 0.35, 700)
	if err != nil {
		return nil, err
	}

	var out headlinesOutput
	if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
		return nil, fmt.Errorf("parse headlines response: %w", err)
	}

	headlines := out.Headlines
	if len(headlines) == 0 {
		headlines = parseFirstStringArrayField(rawJSON, "headlines")
	}

	deduped := dedupeAndTrim(headlines)
	if len(deduped) == 0 {
		return nil, errors.New("groq returned empty headlines")
	}

	return limitListItems(deduped, 5), nil
}

func (s *OpenAIService) GenerateStraplineOptions(
	ctx context.Context,
	facts []string,
	gaps []string,
	article string,
	language string,
) ([]string, error) {
	if s.apiKey == "" {
		return nil, errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}

	factsBlock := "- " + strings.Join(dedupeAndTrim(facts), "\n- ")
	gapsBlock := "- " + strings.Join(dedupeAndTrim(gaps), "\n- ")
	articleBlock := truncateForPrompt(article, 900)

	if strings.TrimSpace(factsBlock) == "-" {
		return nil, errors.New("facts are required to generate straplines")
	}
	if strings.TrimSpace(gapsBlock) == "-" {
		gapsBlock = "- None"
	}

	systemPrompt := fmt.Sprintf(
		"You generate concise editorial straplines from verified facts. Output language must be %s.",
		language,
	)
	userPrompt := prompts.BuildStraplinesPrompt(factsBlock, gapsBlock, articleBlock) + languageConstraint(language)

	rawJSON, err := s.callJSONCompletion(ctx, "generate-straplines", systemPrompt, userPrompt, 0.35, 700)
	if err != nil {
		return nil, err
	}

	var out straplinesOutput
	if err := json.Unmarshal([]byte(rawJSON), &out); err != nil {
		return nil, fmt.Errorf("parse straplines response: %w", err)
	}

	straplines := out.Straplines
	if len(straplines) == 0 {
		straplines = parseFirstStringArrayField(rawJSON, "straplines")
	}

	deduped := dedupeAndTrim(straplines)
	if len(deduped) == 0 {
		return nil, errors.New("groq returned empty straplines")
	}

	return limitListItems(deduped, 4), nil
}

func (s *OpenAIService) TranslateList(ctx context.Context, items []string, language string) ([]string, error) {
	if s.apiKey == "" {
		return nil, errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}

	cleanLanguage := strings.TrimSpace(language)
	if strings.EqualFold(cleanLanguage, "English") || len(items) == 0 {
		return dedupeAndTrim(items), nil
	}

	lines := make([]string, 0, len(items))
	for idx, item := range items {
		clean := strings.TrimSpace(item)
		if clean == "" {
			continue
		}
		lines = append(lines, fmt.Sprintf("%d. %s", idx+1, clean))
	}

	if len(lines) == 0 {
		return nil, errors.New("no items to translate")
	}

	systemPrompt := "You are a precise translator. Preserve factual meaning, tone, and specificity."
	userPrompt := fmt.Sprintf(
		"Translate each line from English into %s.\n\nRules:\n- Keep exactly the same number of lines and same order.\n- Return only plain text with one translated line per output line.\n- Do not return JSON.\n- Do not add bullets or numbering.\n\nInput lines:\n%s",
		cleanLanguage,
		strings.Join(lines, "\n"),
	)

	content, err := s.callCompletion(ctx, "translate-list", systemPrompt, userPrompt, 0.1, 1400, false)
	if err != nil {
		return nil, err
	}

	translated := parseLineList(content)
	if len(translated) == 0 {
		return nil, errors.New("translation returned empty list")
	}
	if len(translated) != len(lines) {
		translated = make([]string, 0, len(lines))
		for _, item := range items {
			single, err := s.TranslateText(ctx, item, cleanLanguage)
			if err != nil {
				return nil, err
			}
			translated = append(translated, single)
		}
	}

	return translated, nil
}

func (s *OpenAIService) TranslateText(ctx context.Context, text string, language string) (string, error) {
	if s.apiKey == "" {
		return "", errors.New("GROQ_API_KEY (or OPENAI_API_KEY) is missing")
	}

	cleanText := strings.TrimSpace(text)
	cleanLanguage := strings.TrimSpace(language)
	if cleanText == "" {
		return "", errors.New("text is empty")
	}
	if strings.EqualFold(cleanLanguage, "English") {
		return cleanText, nil
	}

	systemPrompt := "You are a precise translator for news writing."
	userPrompt := fmt.Sprintf(
		"Translate the following text from English to %s.\n\nRules:\n- Preserve all factual details.\n- Keep the output as a single paragraph.\n- Return only the translated text, no JSON and no explanation.\n\nText:\n%s",
		cleanLanguage,
		cleanText,
	)

	content, err := s.callCompletion(ctx, "translate-article", systemPrompt, userPrompt, 0.1, 1200, false)
	if err != nil {
		return "", err
	}

	translated := strings.TrimSpace(stripCodeFence(content))
	if translated == "" {
		return "", errors.New("translation returned empty text")
	}

	return translated, nil
}

func (s *OpenAIService) callJSONCompletion(
	ctx context.Context,
	step string,
	systemPrompt string,
	userPrompt string,
	temperature float64,
	maxTokens int,
) (string, error) {
	useJSONMode := s.shouldUseResponseFormatJSONMode()
	content, err := s.callCompletion(ctx, step, systemPrompt, userPrompt, temperature, maxTokens, useJSONMode)
	if err != nil {
		var apiErr *apiRequestError
		if useJSONMode && errors.As(err, &apiErr) && shouldRetryWithoutJSONMode(apiErr.Message) {
			log.Printf("[groq][%s] retrying without response_format json_object", step)
			content, err = s.callCompletion(ctx, step, systemPrompt, userPrompt, temperature, maxTokens, false)
		}
	}
	if err != nil {
		return "", err
	}

	cleanJSON, ok := normalizeJSONContent(content)
	if !ok {
		log.Printf("[groq][%s] response was not valid JSON, retrying once without json_object mode", step)
		content, err = s.callCompletion(ctx, step, systemPrompt, userPrompt, temperature, maxTokens, false)
		if err != nil {
			return "", err
		}
		cleanJSON, ok = normalizeJSONContent(content)
	}
	if !ok {
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

	log.Printf("[groq][%s] model=%s provider=%s json_mode=%t", step, s.model, s.provider, useJSONFormat)
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

func (s *OpenAIService) shouldUseResponseFormatJSONMode() bool {
	if strings.EqualFold(s.provider, "groq") {
		return false
	}

	base := strings.ToLower(strings.TrimSpace(s.baseURL))
	if strings.Contains(base, "groq") {
		return false
	}

	return true
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

func limitListItems(values []string, max int) []string {
	if max <= 0 || len(values) <= max {
		return values
	}
	return values[:max]
}

func truncateForPrompt(value string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}

	clean := strings.TrimSpace(value)
	runes := []rune(clean)
	if len(runes) <= maxRunes {
		return clean
	}
	return strings.TrimSpace(string(runes[:maxRunes]))
}

func parseFirstStringArrayField(rawJSON string, preferredKey string) []string {
	payload, ok := parseJSONObject(rawJSON)
	if !ok {
		return nil
	}

	if values := anyToStringSlice(payload[preferredKey]); len(values) > 0 {
		return values
	}

	for key, value := range payload {
		if strings.EqualFold(strings.TrimSpace(key), preferredKey) {
			if values := anyToStringSlice(value); len(values) > 0 {
				return values
			}
		}
	}

	if len(payload) == 1 {
		for _, value := range payload {
			if values := anyToStringSlice(value); len(values) > 0 {
				return values
			}
		}
	}

	return nil
}

func parseFirstStringField(rawJSON string, preferredKey string) string {
	payload, ok := parseJSONObject(rawJSON)
	if !ok {
		return ""
	}

	if value := anyToString(payload[preferredKey]); value != "" {
		return value
	}

	for key, value := range payload {
		if strings.EqualFold(strings.TrimSpace(key), preferredKey) {
			if out := anyToString(value); out != "" {
				return out
			}
		}
	}

	if len(payload) == 1 {
		for _, value := range payload {
			if out := anyToString(value); out != "" {
				return out
			}
		}
	}

	return ""
}

func parseJSONObject(rawJSON string) (map[string]any, bool) {
	var payload map[string]any
	if err := json.Unmarshal([]byte(rawJSON), &payload); err != nil {
		return nil, false
	}
	return payload, true
}

func anyToStringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}

	result := make([]string, 0, len(items))
	for _, item := range items {
		text := anyToString(item)
		if text != "" {
			result = append(result, text)
		}
	}

	return result
}

func anyToString(value any) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(text)
}

var leadingListMarkerPattern = regexp.MustCompile(`^\s*(?:[-*]+|\d+[\)\].:-]?)\s*`)

func parseLineList(content string) []string {
	trimmed := strings.TrimSpace(stripCodeFence(content))
	if trimmed == "" {
		return nil
	}

	var jsonList []string
	if err := json.Unmarshal([]byte(trimmed), &jsonList); err == nil {
		return dedupeAndTrim(jsonList)
	}

	lines := strings.Split(trimmed, "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		clean := strings.TrimSpace(line)
		if clean == "" {
			continue
		}
		clean = leadingListMarkerPattern.ReplaceAllString(clean, "")
		clean = strings.TrimSpace(clean)
		if clean == "" {
			continue
		}
		result = append(result, clean)
	}

	return dedupeAndTrim(result)
}

func stripCodeFence(value string) string {
	trimmed := strings.TrimSpace(value)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	return strings.TrimSpace(trimmed)
}

func normalizeJSONContent(content string) (string, bool) {
	clean := stripCodeFence(content)
	if json.Valid([]byte(clean)) {
		return clean, true
	}

	extracted := extractFirstJSONObject(clean)
	if extracted != "" && json.Valid([]byte(extracted)) {
		return extracted, true
	}

	return "", false
}

func extractFirstJSONObject(value string) string {
	start := strings.Index(value, "{")
	if start < 0 {
		return ""
	}

	depth := 0
	inString := false
	escape := false

	for i := start; i < len(value); i++ {
		ch := value[i]

		if inString {
			if escape {
				escape = false
				continue
			}
			if ch == '\\' {
				escape = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}

		switch ch {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return strings.TrimSpace(value[start : i+1])
			}
		}
	}

	return ""
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

func isRequestTooLargeError(err error) bool {
	var apiErr *apiRequestError
	if !errors.As(err, &apiErr) {
		return false
	}

	return isRequestTooLargeMessage(apiErr.Message)
}

func isRequestTooLargeMessage(message string) bool {
	lower := strings.ToLower(strings.TrimSpace(message))
	if lower == "" {
		return false
	}

	return strings.Contains(lower, "request too large") ||
		strings.Contains(lower, "reduce your message size") ||
		(strings.Contains(lower, "tokens per minute") && strings.Contains(lower, "requested")) ||
		strings.Contains(lower, "context length")
}

func shrinkPromptInput(text string) string {
	const minRunes = 900

	runes := []rune(strings.TrimSpace(text))
	if len(runes) <= minRunes {
		return strings.TrimSpace(text)
	}

	nextLen := int(float64(len(runes)) * 0.72)
	if nextLen < minRunes {
		nextLen = minRunes
	}
	if nextLen >= len(runes) {
		nextLen = len(runes) - 1
	}
	if nextLen <= 0 {
		return strings.TrimSpace(text)
	}

	return strings.TrimSpace(string(runes[:nextLen]))
}

func shouldRetryWithoutJSONMode(message string) bool {
	lower := strings.ToLower(message)
	return strings.Contains(lower, "response_format") ||
		strings.Contains(lower, "json_object") ||
		strings.Contains(lower, "failed to generate json") ||
		strings.Contains(lower, "failed_generation")
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
	return fmt.Sprintf(
		"\n\nImportant: Keep the JSON keys and schema exactly as requested (for example: facts, gaps, article in English). Only translate the string values into %s.",
		language,
	)
}
