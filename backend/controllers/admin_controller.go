package controllers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"nanoheads/services"
)

type AdminController struct {
	adminService *services.AdminService
}

type updateFactRequest struct {
	Text      *string `json:"text"`
	Included  *bool   `json:"included"`
	Confirmed *bool   `json:"confirmed"`
}

type updateGapRequest struct {
	Text     *string `json:"text"`
	Selected *bool   `json:"selected"`
	Resolved *bool   `json:"resolved"`
}

type updateAnalysisRequest struct {
	Status   *string `json:"status"`
	Category *string `json:"category"`
}

type addFactRequest struct {
	Text string `json:"text"`
}

type updateSettingsRequest struct {
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

func NewAdminController(database *sql.DB) *AdminController {
	return &AdminController{
		adminService: services.NewAdminService(database),
	}
}

func (a *AdminController) GetDashboard(c *gin.Context) {
	limit := parseOptionalInt(c.Query("limit"), 5)
	result, err := a.adminService.GetDashboard(c.Request.Context(), limit)
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (a *AdminController) ListAnalyses(c *gin.Context) {
	limit := parseOptionalInt(c.Query("limit"), 100)
	items, err := a.adminService.ListAnalyses(c.Request.Context(), limit)
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
	})
}

func (a *AdminController) GetAnalysis(c *gin.Context) {
	articleID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	detail, err := a.adminService.GetAnalysisDetail(c.Request.Context(), articleID)
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, detail)
}

func (a *AdminController) AddFact(c *gin.Context) {
	articleID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var req addFactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	factID, err := a.adminService.AddFact(c.Request.Context(), articleID, req.Text)
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id": factID,
	})
}

func (a *AdminController) UpdateFact(c *gin.Context) {
	factID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var req updateFactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := a.adminService.UpdateFact(c.Request.Context(), factID, req.Text, req.Included, req.Confirmed); err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *AdminController) UpdateGap(c *gin.Context) {
	gapID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var req updateGapRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := a.adminService.UpdateGap(c.Request.Context(), gapID, req.Text, req.Selected, req.Resolved); err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (a *AdminController) UpdateAnalysis(c *gin.Context) {
	articleID, ok := parsePathID(c, "id")
	if !ok {
		return
	}

	var req updateAnalysisRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := a.adminService.UpdateAnalysis(c.Request.Context(), articleID, req.Status, req.Category); err != nil {
		respondWithError(c, err)
		return
	}

	detail, err := a.adminService.GetAnalysisDetail(c.Request.Context(), articleID)
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, detail)
}

func (a *AdminController) ListCategories(c *gin.Context) {
	categories, err := a.adminService.ListCategories(c.Request.Context())
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"items": categories,
	})
}

func (a *AdminController) GetSettings(c *gin.Context) {
	settings, err := a.adminService.GetSettings(c.Request.Context())
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

func (a *AdminController) UpdateSettings(c *gin.Context) {
	var req updateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := a.adminService.UpdateSettings(c.Request.Context(), req.Provider, req.Model); err != nil {
		respondWithError(c, err)
		return
	}

	settings, err := a.adminService.GetSettings(c.Request.Context())
	if err != nil {
		respondWithError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

func respondWithError(c *gin.Context, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}

	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "required") ||
		strings.Contains(lower, "invalid") ||
		strings.Contains(lower, "must be") ||
		strings.Contains(lower, "no fact fields provided") ||
		strings.Contains(lower, "no gap fields provided") ||
		strings.Contains(lower, "no analysis fields provided") {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}

func parseOptionalInt(raw string, defaultValue int) int {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(clean)
	if err != nil {
		return defaultValue
	}
	return value
}

func parsePathID(c *gin.Context, key string) (int64, bool) {
	value := strings.TrimSpace(c.Param(key))
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return 0, false
	}
	return id, true
}
