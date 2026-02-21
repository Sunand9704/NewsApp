package db

import (
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
)

var connectedDriver string

func Connect(databaseURL string, driverFromEnv string) (*sql.DB, error) {
	driver, dsn, err := resolveDriverAndDSN(databaseURL, driverFromEnv)
	if err != nil {
		return nil, err
	}

	database, err := sql.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := database.Ping(); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	if err := ensureSchema(database, driver); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("ensure schema: %w", err)
	}

	connectedDriver = driver
	return database, nil
}

func Driver() string {
	return connectedDriver
}

func resolveDriverAndDSN(databaseURL string, driverFromEnv string) (string, string, error) {
	driver := strings.ToLower(strings.TrimSpace(driverFromEnv))

	if driver == "" {
		switch {
		case strings.HasPrefix(databaseURL, "postgres://"), strings.HasPrefix(databaseURL, "postgresql://"):
			driver = "postgres"
		case strings.HasPrefix(databaseURL, "mysql://"):
			driver = "mysql"
		default:
			return "", "", errors.New("set DB_DRIVER (postgres or mysql) when DATABASE_URL has no postgres:// or mysql:// prefix")
		}
	}

	switch driver {
	case "postgres", "postgresql":
		return "postgres", databaseURL, nil
	case "mysql":
		dsn := databaseURL
		if strings.HasPrefix(databaseURL, "mysql://") {
			converted, err := mysqlURLToDSN(databaseURL)
			if err != nil {
				return "", "", err
			}
			dsn = converted
		}
		return "mysql", dsn, nil
	default:
		return "", "", fmt.Errorf("unsupported DB_DRIVER %q (allowed: postgres, mysql)", driver)
	}
}

func mysqlURLToDSN(rawURL string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", fmt.Errorf("invalid mysql DATABASE_URL: %w", err)
	}

	if u.User == nil || u.User.Username() == "" {
		return "", errors.New("mysql DATABASE_URL must include username")
	}

	username := u.User.Username()
	password, hasPassword := u.User.Password()
	auth := username
	if hasPassword {
		auth = fmt.Sprintf("%s:%s", username, password)
	}

	dbName := strings.TrimPrefix(u.Path, "/")
	if dbName == "" {
		return "", errors.New("mysql DATABASE_URL must include database name")
	}

	query := u.Query()
	if query.Get("parseTime") == "" {
		query.Set("parseTime", "true")
	}

	dsn := fmt.Sprintf("%s@tcp(%s)/%s", auth, u.Host, dbName)
	encoded := query.Encode()
	if encoded != "" {
		dsn += "?" + encoded
	}

	return dsn, nil
}

func ensureSchema(database *sql.DB, driver string) error {
	var statements []string

	switch driver {
	case "postgres":
		statements = []string{
			`CREATE TABLE IF NOT EXISTS articles (
				id SERIAL PRIMARY KEY,
				source_url TEXT,
				raw_text TEXT,
				status TEXT DEFAULT 'draft',
				selected_format TEXT,
				article_text TEXT,
				headline_selected TEXT,
				strapline_selected TEXT,
				slug TEXT,
				meta_description TEXT,
				topic_id INTEGER,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS raw_text TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS selected_format TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_text TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS headline_selected TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS strapline_selected TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS slug TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_description TEXT;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS topic_id INTEGER;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
			`ALTER TABLE articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`,
			`ALTER TABLE articles ALTER COLUMN status SET DEFAULT 'draft';`,
			`ALTER TABLE articles ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;`,
			`ALTER TABLE articles ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;`,
			`ALTER TABLE articles DROP COLUMN IF EXISTS title;`,
			`ALTER TABLE articles DROP COLUMN IF EXISTS content;`,
			`ALTER TABLE articles DROP COLUMN IF EXISTS verdict;`,
			`CREATE TABLE IF NOT EXISTS facts (
				id SERIAL PRIMARY KEY,
				article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
				fact_text TEXT,
				is_confirmed BOOLEAN DEFAULT false,
				is_included BOOLEAN DEFAULT true,
				source TEXT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS gaps (
				id SERIAL PRIMARY KEY,
				article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
				question TEXT,
				is_resolved BOOLEAN DEFAULT false,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS headlines (
				id SERIAL PRIMARY KEY,
				article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
				headline_text TEXT,
				is_selected BOOLEAN DEFAULT false
			);`,
			`CREATE TABLE IF NOT EXISTS straplines (
				id SERIAL PRIMARY KEY,
				article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
				strapline_text TEXT,
				is_selected BOOLEAN DEFAULT false
			);`,
			`CREATE TABLE IF NOT EXISTS topics (
				id SERIAL PRIMARY KEY,
				name TEXT UNIQUE,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);`,
		}
	case "mysql":
		statements = []string{
			`CREATE TABLE IF NOT EXISTS articles (
				id BIGINT AUTO_INCREMENT PRIMARY KEY,
				source_url TEXT,
				raw_text LONGTEXT,
				status VARCHAR(50) DEFAULT 'draft',
				selected_format VARCHAR(50),
				article_text LONGTEXT,
				headline_selected TEXT,
				strapline_selected TEXT,
				slug TEXT,
				meta_description TEXT,
				topic_id BIGINT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
			);`,
			`CREATE TABLE IF NOT EXISTS facts (
				id BIGINT AUTO_INCREMENT PRIMARY KEY,
				article_id BIGINT,
				fact_text TEXT,
				is_confirmed BOOLEAN DEFAULT FALSE,
				is_included BOOLEAN DEFAULT TRUE,
				source TEXT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
			);`,
			`CREATE TABLE IF NOT EXISTS gaps (
				id BIGINT AUTO_INCREMENT PRIMARY KEY,
				article_id BIGINT,
				question TEXT,
				is_resolved BOOLEAN DEFAULT FALSE,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
			);`,
			`CREATE TABLE IF NOT EXISTS headlines (
				id BIGINT AUTO_INCREMENT PRIMARY KEY,
				article_id BIGINT,
				headline_text TEXT,
				is_selected BOOLEAN DEFAULT FALSE,
				FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
			);`,
			`CREATE TABLE IF NOT EXISTS straplines (
				id BIGINT AUTO_INCREMENT PRIMARY KEY,
				article_id BIGINT,
				strapline_text TEXT,
				is_selected BOOLEAN DEFAULT FALSE,
				FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
			);`,
			`CREATE TABLE IF NOT EXISTS topics (
				id BIGINT AUTO_INCREMENT PRIMARY KEY,
				name VARCHAR(255) UNIQUE,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);`,
		}
	default:
		return fmt.Errorf("unsupported driver for schema creation: %s", driver)
	}

	for _, stmt := range statements {
		if _, err := database.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}
