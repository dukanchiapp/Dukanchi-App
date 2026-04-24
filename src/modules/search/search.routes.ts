import { Router } from "express";
import { SearchController } from "./search.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";

const router = Router();

// /api/search
router.get("/", authenticateToken, SearchController.search);
router.get("/suggestions", authenticateToken, SearchController.getSuggestions);
router.get("/ai", authenticateToken, SearchController.searchAi);

// /api/search-history (Exported separately if mounted separately, or just mounted here)
router.post("/history", authenticateToken, SearchController.saveSearchHistory);
router.delete("/history", authenticateToken, SearchController.clearSearchHistory);

export const searchRoutes = router;
