package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"

	"nanoheads/controllers"
)

func RegisterAnalyseRoutes(router *gin.Engine, database *sql.DB) {
	controller := controllers.NewAnalyseController(database)

	api := router.Group("/api")
	api.POST("/analyse", controller.AnalyseArticle)
}
