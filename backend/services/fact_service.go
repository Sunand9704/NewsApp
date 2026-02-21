package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"nanoheads/db"
	"nanoheads/models"
)

type FactService struct {
	database *sql.DB
	ai       *OpenAIService
}

func NewFactService(database *sql.DB) *FactService {
	return &FactService{
		database: database,
		ai:       NewOpenAIService(),
	}
}

func (s *FactService) RunPhaseOne(ctx context.Context, input models.PhaseOneInput) (models.PhaseOneResponse, error) {
	if s.database == nil {
		return models.PhaseOneResponse{}, errors.New("database is not initialized")
	}

	if err := s.applyRuntimeAISettings(ctx); err != nil {
		return models.PhaseOneResponse{}, err
	}

	rawText, sourceURL, err := s.resolveInput(ctx, input)
	if err != nil {
		return models.PhaseOneResponse{}, err
	}

	outputLanguage := normalizeOutputLanguage(input.Language, rawText)
	generationLanguage := stableGenerationLanguage(outputLanguage)
	llmInput := compactLLMInput(rawText)

	facts, err := s.ai.ExtractFacts(ctx, llmInput, generationLanguage)
	if err != nil {
		return models.PhaseOneResponse{}, err
	}

	gaps, err := s.ai.GenerateGapQuestions(ctx, llmInput, facts, generationLanguage)
	if err != nil {
		return models.PhaseOneResponse{}, err
	}

	articleText, err := s.ai.GenerateStructuredArticle(ctx, facts, gaps, generationLanguage)
	if err != nil {
		return models.PhaseOneResponse{}, err
	}

	if outputLanguage != generationLanguage {
		facts, err = s.ai.TranslateList(ctx, facts, outputLanguage)
		if err != nil {
			return models.PhaseOneResponse{}, err
		}

		gaps, err = s.ai.TranslateList(ctx, gaps, outputLanguage)
		if err != nil {
			return models.PhaseOneResponse{}, err
		}

		articleText, err = s.ai.TranslateText(ctx, articleText, outputLanguage)
		if err != nil {
			return models.PhaseOneResponse{}, err
		}
	}

	articleID, err := s.savePhaseOne(ctx, sourceURL, rawText, articleText, input.Category, facts, gaps)
	if err != nil {
		return models.PhaseOneResponse{}, err
	}

	return models.PhaseOneResponse{
		ArticleID: articleID,
		Language:  outputLanguage,
		Facts:     facts,
		Gaps:      gaps,
		Article:   articleText,
	}, nil
}

func (s *FactService) resolveInput(ctx context.Context, input models.PhaseOneInput) (string, string, error) {
	text := strings.TrimSpace(input.Text)
	sourceURL := strings.TrimSpace(input.URL)

	if text != "" {
		return text, sourceURL, nil
	}
	if sourceURL == "" {
		return "", "", errors.New("provide either text or url")
	}

	parsedURL, err := url.ParseRequestURI(sourceURL)
	if err != nil {
		return "", "", errors.New("url is invalid")
	}

	fetchedText, err := s.fetchURLText(ctx, parsedURL.String())
	if err != nil {
		return "", "", fmt.Errorf("failed to read url content: %w", err)
	}

	if strings.TrimSpace(fetchedText) == "" {
		return "", "", errors.New("could not extract readable text from url")
	}

	return fetchedText, parsedURL.String(), nil
}

func (s *FactService) fetchURLText(ctx context.Context, sourceURL string) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 12 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("url returned status %d", response.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return "", err
	}

	return sanitizeHTMLText(string(body)), nil
}

func (s *FactService) savePhaseOne(
	ctx context.Context,
	sourceURL string,
	rawText string,
	articleText string,
	category string,
	facts []string,
	gaps []string,
) (int64, error) {
	driver := db.Driver()
	tx, err := s.database.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	topicID, err := resolveTopicID(ctx, tx, driver, category)
	if err != nil {
		return 0, err
	}

	articleID, err := insertArticle(ctx, tx, driver, sourceURL, rawText, articleText, topicID)
	if err != nil {
		return 0, err
	}

	if err := insertFacts(ctx, tx, driver, articleID, facts); err != nil {
		return 0, err
	}

	if err := insertGaps(ctx, tx, driver, articleID, gaps); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	committed = true

	return articleID, nil
}

func insertArticle(
	ctx context.Context,
	tx *sql.Tx,
	driver string,
	sourceURL string,
	rawText string,
	articleText string,
	topicID *int64,
) (int64, error) {
	switch driver {
	case "postgres":
		var articleID int64
		query := `INSERT INTO articles (source_url, raw_text, status, selected_format, article_text, topic_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
		if err := tx.QueryRowContext(ctx, query, sourceURL, rawText, "pending", "timeline", articleText, topicID).Scan(&articleID); err != nil {
			return 0, err
		}
		return articleID, nil
	case "mysql":
		query := `INSERT INTO articles (source_url, raw_text, status, selected_format, article_text, topic_id) VALUES (?, ?, ?, ?, ?, ?)`
		result, err := tx.ExecContext(ctx, query, sourceURL, rawText, "pending", "timeline", articleText, topicID)
		if err != nil {
			return 0, err
		}
		articleID, err := result.LastInsertId()
		if err != nil {
			return 0, err
		}
		return articleID, nil
	default:
		return 0, errors.New("unsupported database driver")
	}
}

func insertFacts(ctx context.Context, tx *sql.Tx, driver string, articleID int64, facts []string) error {
	var query string
	switch driver {
	case "postgres":
		query = `INSERT INTO facts (article_id, fact_text, is_confirmed, is_included, source) VALUES ($1, $2, $3, $4, $5)`
	case "mysql":
		query = `INSERT INTO facts (article_id, fact_text, is_confirmed, is_included, source) VALUES (?, ?, ?, ?, ?)`
	default:
		return errors.New("unsupported database driver")
	}

	for _, fact := range facts {
		cleanFact := strings.TrimSpace(fact)
		if cleanFact == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, query, articleID, cleanFact, false, true, "ai"); err != nil {
			return err
		}
	}
	return nil
}

func insertGaps(ctx context.Context, tx *sql.Tx, driver string, articleID int64, gaps []string) error {
	var query string
	switch driver {
	case "postgres":
		query = `INSERT INTO gaps (article_id, question, is_selected, is_resolved) VALUES ($1, $2, $3, $4)`
	case "mysql":
		query = `INSERT INTO gaps (article_id, question, is_selected, is_resolved) VALUES (?, ?, ?, ?)`
	default:
		return errors.New("unsupported database driver")
	}

	for _, gap := range gaps {
		cleanGap := strings.TrimSpace(gap)
		if cleanGap == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, query, articleID, cleanGap, true, false); err != nil {
			return err
		}
	}
	return nil
}

func resolveTopicID(ctx context.Context, tx *sql.Tx, driver string, category string) (*int64, error) {
	cleanCategory := strings.TrimSpace(category)
	if cleanCategory == "" {
		return nil, nil
	}

	switch driver {
	case "postgres":
		var topicID int64
		selectQuery := `SELECT id FROM topics WHERE LOWER(name) = LOWER($1) LIMIT 1`
		err := tx.QueryRowContext(ctx, selectQuery, cleanCategory).Scan(&topicID)
		if err == nil {
			return &topicID, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}

		insertQuery := `INSERT INTO topics (name) VALUES ($1) RETURNING id`
		if err := tx.QueryRowContext(ctx, insertQuery, cleanCategory).Scan(&topicID); err != nil {
			return nil, err
		}
		return &topicID, nil
	case "mysql":
		var topicID int64
		selectQuery := `SELECT id FROM topics WHERE LOWER(name) = LOWER(?) LIMIT 1`
		err := tx.QueryRowContext(ctx, selectQuery, cleanCategory).Scan(&topicID)
		if err == nil {
			return &topicID, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}

		insertQuery := `INSERT INTO topics (name) VALUES (?)`
		result, err := tx.ExecContext(ctx, insertQuery, cleanCategory)
		if err != nil {
			return nil, err
		}
		topicID, err = result.LastInsertId()
		if err != nil {
			return nil, err
		}
		return &topicID, nil
	default:
		return nil, errors.New("unsupported database driver")
	}
}

var (
	scriptStyleTagPattern = regexp.MustCompile(`(?is)<(script|style).*?>.*?</(script|style)>`)
	htmlTagPattern        = regexp.MustCompile(`(?s)<[^>]*>`)
	whitespacePattern     = regexp.MustCompile(`\s+`)
)

func sanitizeHTMLText(value string) string {
	noScripts := scriptStyleTagPattern.ReplaceAllString(value, " ")
	noTags := htmlTagPattern.ReplaceAllString(noScripts, " ")
	decoded := html.UnescapeString(noTags)
	return strings.TrimSpace(whitespacePattern.ReplaceAllString(decoded, " "))
}

func normalizeOutputLanguage(requested string, inputText string) string {
	clean := strings.ToLower(strings.TrimSpace(requested))

	switch clean {
	case "te", "telugu", "తెలుగు":
		return "Telugu"
	case "en", "english":
		return "English"
	}

	if containsTeluguScript(inputText) {
		return "Telugu"
	}

	return "English"
}

func containsTeluguScript(value string) bool {
	for _, r := range value {
		if r >= 0x0C00 && r <= 0x0C7F {
			return true
		}
	}
	return false
}

func stableGenerationLanguage(outputLanguage string) string {
	if strings.EqualFold(strings.TrimSpace(outputLanguage), "Telugu") {
		return "English"
	}
	return outputLanguage
}

func compactLLMInput(raw string) string {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return clean
	}

	const maxRunes = 12000
	runes := []rune(clean)
	if len(runes) <= maxRunes {
		return clean
	}

	return string(runes[:maxRunes])
}

func (s *FactService) applyRuntimeAISettings(ctx context.Context) error {
	query := `
		SELECT p.provider_key, m.model_key
		FROM app_settings s
		JOIN ai_providers p ON p.id = s.provider_id
		JOIN ai_models m ON m.id = s.model_id
		WHERE s.id = 1
		LIMIT 1;
	`

	var (
		providerKey string
		modelKey    string
	)

	err := s.database.QueryRowContext(ctx, query).Scan(&providerKey, &modelKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	s.ai.ApplySettings(providerKey, modelKey)
	return nil
}
