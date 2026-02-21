package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"

	appdb "nanoheads/db"
)

type seedIDs struct {
	TopicID     int64
	ArticleID   int64
	FactID      int64
	GapID       int64
	HeadlineAID int64
	HeadlineBID int64
	StraplineID int64
}

func main() {
	_ = godotenv.Load()

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	database, err := appdb.Connect(databaseURL, os.Getenv("DB_DRIVER"))
	if err != nil {
		log.Fatalf("connect failed: %v", err)
	}
	defer database.Close()

	driver := appdb.Driver()
	ctx := context.Background()

	tx, err := database.BeginTx(ctx, nil)
	if err != nil {
		log.Fatalf("begin transaction: %v", err)
	}

	ids, err := seedAll(ctx, tx, driver)
	if err != nil {
		_ = tx.Rollback()
		log.Fatalf("seed failed: %v", err)
	}

	if err := tx.Commit(); err != nil {
		log.Fatalf("commit failed: %v", err)
	}

	fmt.Println("Seed completed successfully.")
	fmt.Printf(
		"Inserted IDs -> topic:%d article:%d fact:%d gap:%d headlineA:%d headlineB:%d strapline:%d\n",
		ids.TopicID, ids.ArticleID, ids.FactID, ids.GapID, ids.HeadlineAID, ids.HeadlineBID, ids.StraplineID,
	)

	printCounts(ctx, database)
}

func seedAll(ctx context.Context, tx *sql.Tx, driver string) (seedIDs, error) {
	stamp := time.Now().Unix()
	topicName := fmt.Sprintf("seed-topic-%d", stamp)
	sourceURL := fmt.Sprintf("https://example.com/seed/%d", stamp)

	topicID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO topics (name) VALUES ($1) RETURNING id`,
		`INSERT INTO topics (name) VALUES (?)`,
		topicName,
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert topic: %w", err)
	}

	articleID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO articles (source_url, raw_text, status, selected_format, article_text, headline_selected, strapline_selected, slug, meta_description, topic_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
		`INSERT INTO articles (source_url, raw_text, status, selected_format, article_text, headline_selected, strapline_selected, slug, meta_description, topic_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sourceURL,
		"Seed raw text for schema validation.",
		"draft",
		"timeline",
		"Seeded article text for end-to-end schema check.",
		"Seed Headline Selected",
		"Seed Strapline Selected",
		fmt.Sprintf("seed-article-%d", stamp),
		"Seed meta description",
		topicID,
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert article: %w", err)
	}

	factID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO facts (article_id, fact_text, is_confirmed, is_included, source) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		`INSERT INTO facts (article_id, fact_text, is_confirmed, is_included, source) VALUES (?, ?, ?, ?, ?)`,
		articleID,
		"Seed fact: this record validates facts table wiring.",
		false,
		true,
		"manual",
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert fact: %w", err)
	}

	gapID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO gaps (article_id, question, is_resolved) VALUES ($1, $2, $3) RETURNING id`,
		`INSERT INTO gaps (article_id, question, is_resolved) VALUES (?, ?, ?)`,
		articleID,
		"Seed gap question: what source confirms this claim?",
		false,
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert gap: %w", err)
	}

	headlineAID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO headlines (article_id, headline_text, is_selected) VALUES ($1, $2, $3) RETURNING id`,
		`INSERT INTO headlines (article_id, headline_text, is_selected) VALUES (?, ?, ?)`,
		articleID,
		"Seed Headline Option A",
		false,
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert headline A: %w", err)
	}

	headlineBID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO headlines (article_id, headline_text, is_selected) VALUES ($1, $2, $3) RETURNING id`,
		`INSERT INTO headlines (article_id, headline_text, is_selected) VALUES (?, ?, ?)`,
		articleID,
		"Seed Headline Option B",
		true,
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert headline B: %w", err)
	}

	straplineID, err := insertWithID(
		ctx,
		tx,
		driver,
		`INSERT INTO straplines (article_id, strapline_text, is_selected) VALUES ($1, $2, $3) RETURNING id`,
		`INSERT INTO straplines (article_id, strapline_text, is_selected) VALUES (?, ?, ?)`,
		articleID,
		"Seed Strapline Option",
		true,
	)
	if err != nil {
		return seedIDs{}, fmt.Errorf("insert strapline: %w", err)
	}

	return seedIDs{
		TopicID:     topicID,
		ArticleID:   articleID,
		FactID:      factID,
		GapID:       gapID,
		HeadlineAID: headlineAID,
		HeadlineBID: headlineBID,
		StraplineID: straplineID,
	}, nil
}

func insertWithID(
	ctx context.Context,
	tx *sql.Tx,
	driver string,
	postgresQuery string,
	mysqlQuery string,
	args ...any,
) (int64, error) {
	switch driver {
	case "postgres":
		var id int64
		if err := tx.QueryRowContext(ctx, postgresQuery, args...).Scan(&id); err != nil {
			return 0, err
		}
		return id, nil
	case "mysql":
		res, err := tx.ExecContext(ctx, mysqlQuery, args...)
		if err != nil {
			return 0, err
		}
		id, err := res.LastInsertId()
		if err != nil {
			return 0, err
		}
		return id, nil
	default:
		return 0, fmt.Errorf("unsupported driver: %s", driver)
	}
}

func printCounts(ctx context.Context, database *sql.DB) {
	tables := []string{
		"topics",
		"articles",
		"facts",
		"gaps",
		"headlines",
		"straplines",
	}

	fmt.Println("Row counts:")
	for _, table := range tables {
		var count int64
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
		if err := database.QueryRowContext(ctx, query).Scan(&count); err != nil {
			fmt.Printf("  %s: error (%v)\n", table, err)
			continue
		}
		fmt.Printf("  %s: %d\n", table, count)
	}
}
