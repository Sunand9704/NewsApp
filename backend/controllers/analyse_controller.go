package controllers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"nanoheads/models"
	"nanoheads/services"
)

type AnalyseController struct {
	factService *services.FactService
}

type analyseRequest struct {
	Text     string `json:"text"`
	URL      string `json:"url"`
	Content  string `json:"content"`
	Language string `json:"language"`
}

func NewAnalyseController(database *sql.DB) *AnalyseController {
	return &AnalyseController{
		factService: services.NewFactService(database),
	}
}

func (a *AnalyseController) AnalyseArticle(c *gin.Context) {
	var req analyseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	text := strings.TrimSpace(req.Text)
	if text == "" {
		text = strings.TrimSpace(req.Content)
	}

	urlValue := strings.TrimSpace(req.URL)
	language := strings.TrimSpace(req.Language)
	if text == "" && urlValue == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "provide either text or url",
		})
		return
	}

	log.Printf(
		"phase-1 incoming request: text=%s url=%s language=%s",
		previewForLog(text),
		previewForLog(urlValue),
		previewForLog(language),
	)

	result, err := a.factService.RunPhaseOne(c.Request.Context(), models.PhaseOneInput{
		Text:     text,
		URL:      urlValue,
		Language: language,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	responseBytes, err := json.Marshal(result)
	if err == nil {
		log.Printf("phase-1 response: %s", responseBytes)
	}

	c.JSON(http.StatusOK, result)
}

func previewForLog(value string) string {
	if strings.TrimSpace(value) == "" {
		return "<empty>"
	}

	const maxRunes = 500
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}

	return string(runes[:maxRunes]) + "... [truncated]"
}
