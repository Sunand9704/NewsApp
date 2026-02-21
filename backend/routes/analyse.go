package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"nanoheads/controllers"
)

func RegisterAnalyseRoutes(router *gin.Engine, database *sql.DB) {
	controller := controllers.NewAnalyseController(database)
	adminController := controllers.NewAdminController(database)

	api := router.Group("/api")
	api.POST("/analyse", controller.AnalyseArticle)
	api.GET("/dashboard", adminController.GetDashboard)
	api.GET("/analyses", adminController.ListAnalyses)
	api.GET("/analyses/:id", adminController.GetAnalysis)
	api.PATCH("/analyses/:id", adminController.UpdateAnalysis)
	api.POST("/analyses/:id/facts", adminController.AddFact)
	api.PATCH("/facts/:id", adminController.UpdateFact)
	api.DELETE("/facts/:id", adminController.DeleteFact)
	api.PATCH("/gaps/:id", adminController.UpdateGap)
	api.GET("/categories", adminController.ListCategories)
	api.GET("/settings", adminController.GetSettings)
	api.PUT("/settings", adminController.UpdateSettings)
}
