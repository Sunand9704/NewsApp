package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"nanoheads/db"
	"nanoheads/models"
)

type AdminService struct {
	database *sql.DB
	driver   string
}

func NewAdminService(database *sql.DB) *AdminService {
	return &AdminService{
		database: database,
		driver:   db.Driver(),
	}
}

func (s *AdminService) GetDashboard(ctx context.Context, limit int) (models.DashboardResponse, error) {
	totalAnalyses, err := s.count(ctx, `SELECT COUNT(*) FROM articles`)
	if err != nil {
		return models.DashboardResponse{}, err
	}

	pendingReview, err := s.count(ctx, `SELECT COUNT(*) FROM articles WHERE LOWER(COALESCE(status, 'draft')) = 'pending'`)
	if err != nil {
		return models.DashboardResponse{}, err
	}

	savedArticles, err := s.count(ctx, `SELECT COUNT(*) FROM articles WHERE LOWER(COALESCE(status, 'draft')) = 'completed'`)
	if err != nil {
		return models.DashboardResponse{}, err
	}

	includedFacts, totalFacts, err := s.factUsage(ctx)
	if err != nil {
		return models.DashboardResponse{}, err
	}

	aiUsagePct := int64(0)
	if totalFacts > 0 {
		aiUsagePct = (includedFacts * 100) / totalFacts
	}

	recentAnalyses, err := s.ListAnalyses(ctx, limit)
	if err != nil {
		return models.DashboardResponse{}, err
	}

	return models.DashboardResponse{
		Summary: models.DashboardSummary{
			TotalAnalyses: totalAnalyses,
			PendingReview: pendingReview,
			SavedArticles: savedArticles,
			AIUsagePct:    aiUsagePct,
			AIUsageText:   fmt.Sprintf("%d included / %d total facts", includedFacts, totalFacts),
		},
		RecentAnalyses: recentAnalyses,
	}, nil
}

func (s *AdminService) ListAnalyses(ctx context.Context, limit int) ([]models.AnalysisListItem, error) {
	limit = normalizeLimit(limit)

	query := `
		SELECT
			a.id,
			COALESCE(t.name, 'Uncategorized') AS category,
			COALESCE(a.status, 'draft') AS status,
			COALESCE(a.created_at, CURRENT_TIMESTAMP) AS created_at,
			COALESCE(a.headline_selected, '') AS headline_selected,
			COALESCE(a.source_url, '') AS source_url,
			COALESCE(a.raw_text, '') AS raw_text
		FROM articles a
		LEFT JOIN topics t ON t.id = a.topic_id
		ORDER BY a.created_at DESC
		LIMIT %s;
	`

	limitParam := "?"
	args := []any{limit}
	if s.driver == "postgres" {
		limitParam = "$1"
	}

	rows, err := s.database.QueryContext(ctx, fmt.Sprintf(query, limitParam), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.AnalysisListItem, 0, limit)
	for rows.Next() {
		var (
			id        int64
			category  string
			status    string
			createdAt time.Time
			headline  string
			sourceURL string
			rawText   string
		)

		if err := rows.Scan(&id, &category, &status, &createdAt, &headline, &sourceURL, &rawText); err != nil {
			return nil, err
		}

		items = append(items, models.AnalysisListItem{
			ID:        id,
			Title:     buildAnalysisTitle(id, headline, sourceURL, rawText),
			Category:  category,
			Status:    formatStatus(status),
			CreatedAt: createdAt,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return items, nil
}

func (s *AdminService) GetAnalysisDetail(ctx context.Context, articleID int64) (models.AnalysisDetail, error) {
	articleQuery := `
		SELECT
			a.id,
			COALESCE(t.name, 'Uncategorized') AS category,
			COALESCE(a.status, 'draft') AS status,
			COALESCE(a.created_at, CURRENT_TIMESTAMP) AS created_at,
			COALESCE(a.headline_selected, '') AS headline_selected,
			COALESCE(a.source_url, '') AS source_url,
			COALESCE(a.raw_text, '') AS raw_text,
			COALESCE(a.article_text, '') AS article_text
		FROM articles a
		LEFT JOIN topics t ON t.id = a.topic_id
		WHERE a.id = %s
		LIMIT 1;
	`

	idParam := "?"
	args := []any{articleID}
	if s.driver == "postgres" {
		idParam = "$1"
	}

	var (
		id         int64
		category   string
		status     string
		createdAt  time.Time
		headline   string
		sourceURL  string
		rawText    string
		articleTxt string
	)

	if err := s.database.QueryRowContext(ctx, fmt.Sprintf(articleQuery, idParam), args...).Scan(
		&id,
		&category,
		&status,
		&createdAt,
		&headline,
		&sourceURL,
		&rawText,
		&articleTxt,
	); err != nil {
		return models.AnalysisDetail{}, err
	}

	facts, err := s.listFactsByArticleID(ctx, articleID)
	if err != nil {
		return models.AnalysisDetail{}, err
	}

	gaps, err := s.listGapsByArticleID(ctx, articleID)
	if err != nil {
		return models.AnalysisDetail{}, err
	}

	return models.AnalysisDetail{
		ID:          id,
		Title:       buildAnalysisTitle(id, headline, sourceURL, rawText),
		Category:    category,
		Status:      formatStatus(status),
		SourceURL:   sourceURL,
		RawText:     rawText,
		ArticleText: articleTxt,
		CreatedAt:   createdAt,
		Facts:       facts,
		Gaps:        gaps,
	}, nil
}

func (s *AdminService) AddFact(ctx context.Context, articleID int64, text string) (int64, error) {
	cleanText := strings.TrimSpace(text)
	if cleanText == "" {
		return 0, errors.New("fact text is required")
	}

	switch s.driver {
	case "postgres":
		var factID int64
		query := `INSERT INTO facts (article_id, fact_text, is_confirmed, is_included, source) VALUES ($1, $2, $3, $4, $5) RETURNING id`
		if err := s.database.QueryRowContext(ctx, query, articleID, cleanText, false, true, "manual").Scan(&factID); err != nil {
			return 0, err
		}
		return factID, nil
	case "mysql":
		query := `INSERT INTO facts (article_id, fact_text, is_confirmed, is_included, source) VALUES (?, ?, ?, ?, ?)`
		result, err := s.database.ExecContext(ctx, query, articleID, cleanText, false, true, "manual")
		if err != nil {
			return 0, err
		}
		factID, err := result.LastInsertId()
		if err != nil {
			return 0, err
		}
		return factID, nil
	default:
		return 0, errors.New("unsupported database driver")
	}
}

func (s *AdminService) UpdateFact(ctx context.Context, factID int64, text *string, included *bool, confirmed *bool) error {
	setClauses := make([]string, 0, 3)
	args := make([]any, 0, 4)
	placeholderIndex := 1

	if text != nil {
		clean := strings.TrimSpace(*text)
		setClauses = append(setClauses, fmt.Sprintf("fact_text = %s", s.bind(placeholderIndex)))
		args = append(args, clean)
		placeholderIndex++
	}
	if included != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_included = %s", s.bind(placeholderIndex)))
		args = append(args, *included)
		placeholderIndex++
	}
	if confirmed != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_confirmed = %s", s.bind(placeholderIndex)))
		args = append(args, *confirmed)
		placeholderIndex++
	}

	if len(setClauses) == 0 {
		return errors.New("no fact fields provided")
	}

	args = append(args, factID)
	query := fmt.Sprintf(
		"UPDATE facts SET %s WHERE id = %s",
		strings.Join(setClauses, ", "),
		s.bind(placeholderIndex),
	)

	result, err := s.database.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	return ensureRowsAffected(result)
}

func (s *AdminService) UpdateGap(ctx context.Context, gapID int64, text *string, selected *bool, resolved *bool) error {
	setClauses := make([]string, 0, 3)
	args := make([]any, 0, 4)
	placeholderIndex := 1

	if text != nil {
		clean := strings.TrimSpace(*text)
		setClauses = append(setClauses, fmt.Sprintf("question = %s", s.bind(placeholderIndex)))
		args = append(args, clean)
		placeholderIndex++
	}
	if selected != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_selected = %s", s.bind(placeholderIndex)))
		args = append(args, *selected)
		placeholderIndex++
	}
	if resolved != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_resolved = %s", s.bind(placeholderIndex)))
		args = append(args, *resolved)
		placeholderIndex++
	}

	if len(setClauses) == 0 {
		return errors.New("no gap fields provided")
	}

	args = append(args, gapID)
	query := fmt.Sprintf(
		"UPDATE gaps SET %s WHERE id = %s",
		strings.Join(setClauses, ", "),
		s.bind(placeholderIndex),
	)

	result, err := s.database.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	return ensureRowsAffected(result)
}

func (s *AdminService) UpdateAnalysis(ctx context.Context, articleID int64, status *string, category *string) error {
	setClauses := make([]string, 0, 3)
	args := make([]any, 0, 4)
	placeholderIndex := 1
	updated := false

	if status != nil {
		normalizedStatus, err := normalizeAnalysisStatus(*status)
		if err != nil {
			return err
		}
		setClauses = append(setClauses, fmt.Sprintf("status = %s", s.bind(placeholderIndex)))
		args = append(args, normalizedStatus)
		placeholderIndex++
		updated = true
	}

	if category != nil {
		topicID, err := s.getOrCreateTopic(ctx, *category)
		if err != nil {
			return err
		}
		setClauses = append(setClauses, fmt.Sprintf("topic_id = %s", s.bind(placeholderIndex)))
		args = append(args, topicID)
		placeholderIndex++
		updated = true
	}

	if !updated {
		return errors.New("no analysis fields provided")
	}

	setClauses = append(setClauses, "updated_at = CURRENT_TIMESTAMP")

	args = append(args, articleID)
	query := fmt.Sprintf(
		"UPDATE articles SET %s WHERE id = %s",
		strings.Join(setClauses, ", "),
		s.bind(placeholderIndex),
	)

	result, err := s.database.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	return ensureRowsAffected(result)
}

func (s *AdminService) ListCategories(ctx context.Context) ([]string, error) {
	rows, err := s.database.QueryContext(ctx, `SELECT name FROM topics ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		cleanName := strings.TrimSpace(name)
		if cleanName == "" {
			continue
		}
		categories = append(categories, cleanName)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return categories, nil
}

func (s *AdminService) GetSettings(ctx context.Context) (models.SettingsResponse, error) {
	providers, err := s.listProvidersAndModels(ctx)
	if err != nil {
		return models.SettingsResponse{}, err
	}

	currentQuery := `
		SELECT
			p.provider_key,
			m.model_key,
			s.updated_at
		FROM app_settings s
		JOIN ai_providers p ON p.id = s.provider_id
		JOIN ai_models m ON m.id = s.model_id
		WHERE s.id = 1
		LIMIT 1;
	`

	var (
		providerKey string
		modelKey    string
		updatedAt   time.Time
	)

	err = s.database.QueryRowContext(ctx, currentQuery).Scan(&providerKey, &modelKey, &updatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return models.SettingsResponse{
			Providers: providers,
		}, nil
	}
	if err != nil {
		return models.SettingsResponse{}, err
	}

	return models.SettingsResponse{
		Provider:  providerKey,
		Model:     modelKey,
		UpdatedAt: updatedAt,
		Providers: providers,
	}, nil
}

func (s *AdminService) UpdateSettings(ctx context.Context, providerKey string, modelKey string) error {
	cleanProvider := strings.TrimSpace(providerKey)
	cleanModel := strings.TrimSpace(modelKey)
	if cleanProvider == "" || cleanModel == "" {
		return errors.New("provider and model are required")
	}

	var (
		providerID int64
		modelID    int64
	)

	matchQuery := `
		SELECT p.id, m.id
		FROM ai_providers p
		JOIN ai_models m ON m.provider_id = p.id
		WHERE p.provider_key = %s AND m.model_key = %s
		LIMIT 1;
	`

	matchProviderBind := "?"
	matchModelBind := "?"
	if s.driver == "postgres" {
		matchProviderBind = "$1"
		matchModelBind = "$2"
	}

	if err := s.database.QueryRowContext(
		ctx,
		fmt.Sprintf(matchQuery, matchProviderBind, matchModelBind),
		cleanProvider,
		cleanModel,
	).Scan(&providerID, &modelID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("invalid provider/model selection")
		}
		return err
	}

	switch s.driver {
	case "postgres":
		query := `
			INSERT INTO app_settings (id, provider_id, model_id, updated_at)
			VALUES (1, $1, $2, CURRENT_TIMESTAMP)
			ON CONFLICT (id) DO UPDATE SET
				provider_id = EXCLUDED.provider_id,
				model_id = EXCLUDED.model_id,
				updated_at = CURRENT_TIMESTAMP;
		`
		if _, err := s.database.ExecContext(ctx, query, providerID, modelID); err != nil {
			return err
		}
	case "mysql":
		query := `
			INSERT INTO app_settings (id, provider_id, model_id, updated_at)
			VALUES (1, ?, ?, CURRENT_TIMESTAMP)
			ON DUPLICATE KEY UPDATE
				provider_id = VALUES(provider_id),
				model_id = VALUES(model_id),
				updated_at = CURRENT_TIMESTAMP;
		`
		if _, err := s.database.ExecContext(ctx, query, providerID, modelID); err != nil {
			return err
		}
	default:
		return errors.New("unsupported database driver")
	}

	return nil
}

func (s *AdminService) listFactsByArticleID(ctx context.Context, articleID int64) ([]models.AnalysisFact, error) {
	query := `
		SELECT id, COALESCE(fact_text, ''), COALESCE(is_included, false), COALESCE(is_confirmed, false), COALESCE(source, '')
		FROM facts
		WHERE article_id = %s
		ORDER BY id ASC;
	`

	idBind := "?"
	if s.driver == "postgres" {
		idBind = "$1"
	}

	rows, err := s.database.QueryContext(ctx, fmt.Sprintf(query, idBind), articleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	facts := make([]models.AnalysisFact, 0)
	for rows.Next() {
		var fact models.AnalysisFact
		if err := rows.Scan(&fact.ID, &fact.Text, &fact.Included, &fact.Confirmed, &fact.Source); err != nil {
			return nil, err
		}
		facts = append(facts, fact)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return facts, nil
}

func (s *AdminService) listGapsByArticleID(ctx context.Context, articleID int64) ([]models.AnalysisGap, error) {
	query := `
		SELECT id, COALESCE(question, ''), COALESCE(is_selected, true), COALESCE(is_resolved, false)
		FROM gaps
		WHERE article_id = %s
		ORDER BY id ASC;
	`

	idBind := "?"
	if s.driver == "postgres" {
		idBind = "$1"
	}

	rows, err := s.database.QueryContext(ctx, fmt.Sprintf(query, idBind), articleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	gaps := make([]models.AnalysisGap, 0)
	for rows.Next() {
		var gap models.AnalysisGap
		if err := rows.Scan(&gap.ID, &gap.Text, &gap.Selected, &gap.Resolved); err != nil {
			return nil, err
		}
		gaps = append(gaps, gap)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return gaps, nil
}

func (s *AdminService) listProvidersAndModels(ctx context.Context) ([]models.ProviderOption, error) {
	query := `
		SELECT
			p.id,
			p.provider_key,
			p.display_name,
			m.id,
			m.model_key,
			m.display_name,
			COALESCE(m.is_default, false)
		FROM ai_providers p
		LEFT JOIN ai_models m ON m.provider_id = p.id
		ORDER BY p.id ASC, m.id ASC;
	`

	rows, err := s.database.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	providers := make([]models.ProviderOption, 0)
	indexByProviderID := make(map[int64]int)

	for rows.Next() {
		var (
			providerID   int64
			providerKey  string
			providerName string
			modelID      sql.NullInt64
			modelKey     sql.NullString
			modelName    sql.NullString
			modelDefault sql.NullBool
		)

		if err := rows.Scan(
			&providerID,
			&providerKey,
			&providerName,
			&modelID,
			&modelKey,
			&modelName,
			&modelDefault,
		); err != nil {
			return nil, err
		}

		providerIndex, exists := indexByProviderID[providerID]
		if !exists {
			providers = append(providers, models.ProviderOption{
				ID:     providerID,
				Key:    providerKey,
				Name:   providerName,
				Models: make([]models.ModelOption, 0),
			})
			providerIndex = len(providers) - 1
			indexByProviderID[providerID] = providerIndex
		}

		if modelID.Valid {
			providers[providerIndex].Models = append(providers[providerIndex].Models, models.ModelOption{
				ID:        modelID.Int64,
				Key:       modelKey.String,
				Name:      modelName.String,
				IsDefault: modelDefault.Valid && modelDefault.Bool,
			})
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return providers, nil
}

func (s *AdminService) getOrCreateTopic(ctx context.Context, category string) (int64, error) {
	cleanCategory := strings.TrimSpace(category)
	if cleanCategory == "" {
		return 0, errors.New("category cannot be empty")
	}

	selectQuery := `SELECT id FROM topics WHERE LOWER(name) = LOWER(%s) LIMIT 1`
	selectBind := "?"
	if s.driver == "postgres" {
		selectBind = "$1"
	}

	var topicID int64
	err := s.database.QueryRowContext(ctx, fmt.Sprintf(selectQuery, selectBind), cleanCategory).Scan(&topicID)
	if err == nil {
		return topicID, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}

	switch s.driver {
	case "postgres":
		insertQuery := `INSERT INTO topics (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id`
		insertErr := s.database.QueryRowContext(ctx, insertQuery, cleanCategory).Scan(&topicID)
		if insertErr == nil {
			return topicID, nil
		}
		if !errors.Is(insertErr, sql.ErrNoRows) {
			return 0, insertErr
		}

		if err := s.database.QueryRowContext(ctx, `SELECT id FROM topics WHERE LOWER(name) = LOWER($1) LIMIT 1`, cleanCategory).Scan(&topicID); err != nil {
			return 0, err
		}
		return topicID, nil
	case "mysql":
		if _, err := s.database.ExecContext(ctx, `INSERT IGNORE INTO topics (name) VALUES (?)`, cleanCategory); err != nil {
			return 0, err
		}
		if err := s.database.QueryRowContext(ctx, `SELECT id FROM topics WHERE LOWER(name) = LOWER(?) LIMIT 1`, cleanCategory).Scan(&topicID); err != nil {
			return 0, err
		}
		return topicID, nil
	default:
		return 0, errors.New("unsupported database driver")
	}
}

func (s *AdminService) factUsage(ctx context.Context) (int64, int64, error) {
	query := `SELECT COALESCE(SUM(CASE WHEN is_included THEN 1 ELSE 0 END), 0), COUNT(*) FROM facts`

	var (
		included int64
		total    int64
	)
	if err := s.database.QueryRowContext(ctx, query).Scan(&included, &total); err != nil {
		return 0, 0, err
	}
	return included, total, nil
}

func (s *AdminService) count(ctx context.Context, query string) (int64, error) {
	var value int64
	if err := s.database.QueryRowContext(ctx, query).Scan(&value); err != nil {
		return 0, err
	}
	return value, nil
}

func (s *AdminService) bind(index int) string {
	if s.driver == "postgres" {
		return fmt.Sprintf("$%d", index)
	}
	return "?"
}

func ensureRowsAffected(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func buildAnalysisTitle(articleID int64, headline string, sourceURL string, rawText string) string {
	if cleanHeadline := strings.TrimSpace(headline); cleanHeadline != "" {
		return truncate(cleanHeadline, 120)
	}

	if cleanSource := strings.TrimSpace(sourceURL); cleanSource != "" {
		if parsed, err := url.Parse(cleanSource); err == nil && parsed.Host != "" {
			hostPath := strings.TrimSpace(parsed.Host + parsed.Path)
			if hostPath != "" && hostPath != "/" {
				return truncate(hostPath, 120)
			}
		}
		return truncate(cleanSource, 120)
	}

	if cleanRaw := strings.TrimSpace(rawText); cleanRaw != "" {
		return truncate(singleLine(cleanRaw), 120)
	}

	return fmt.Sprintf("Analysis #%d", articleID)
}

func normalizeAnalysisStatus(status string) (string, error) {
	clean := strings.ToLower(strings.TrimSpace(status))
	switch clean {
	case "draft", "pending", "completed":
		return clean, nil
	default:
		return "", errors.New("status must be draft, pending, or completed")
	}
}

func formatStatus(status string) string {
	clean := strings.ToLower(strings.TrimSpace(status))
	switch clean {
	case "completed":
		return "Completed"
	case "pending":
		return "Pending"
	case "draft":
		return "Draft"
	default:
		if clean == "" {
			return "Draft"
		}
		return strings.ToUpper(clean[:1]) + clean[1:]
	}
}

func normalizeLimit(limit int) int {
	if limit <= 0 {
		return 10
	}
	if limit > 200 {
		return 200
	}
	return limit
}

func singleLine(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func truncate(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max]) + "..."
}
