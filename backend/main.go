package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"nanoheads/db"
	"nanoheads/routes"
)

func main() {
	_ = godotenv.Load()

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required in .env")
	}

	database, err := db.Connect(databaseURL, os.Getenv("DB_DRIVER"))
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer database.Close()

	router := gin.Default()
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"db":     "connected",
		})
	})

	routes.RegisterAnalyseRoutes(router, database)

	if err := router.Run(":8085"); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
