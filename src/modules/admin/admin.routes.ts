import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authenticateToken, requireAdmin } from "../../middlewares/auth.middleware";
import { upload } from "../../middlewares/upload.middleware";

const router = Router();

// /api/admin
router.get("/stats", authenticateToken, requireAdmin, AdminController.getStats);
router.get("/users", authenticateToken, requireAdmin, AdminController.getUsers);
router.post("/reset-password", authenticateToken, requireAdmin, AdminController.resetPassword);
router.put("/users/:id", authenticateToken, requireAdmin, AdminController.updateUser);
router.post("/users/bulk-update", authenticateToken, requireAdmin, AdminController.bulkUpdateUsers);
router.delete("/users/:id", authenticateToken, requireAdmin, AdminController.deleteUser);

router.get("/stores", authenticateToken, requireAdmin, AdminController.getStores);
router.delete("/stores/:id", authenticateToken, requireAdmin, AdminController.deleteStore);
router.get("/store-members", authenticateToken, requireAdmin, AdminController.getStoreMembersList);
router.get("/store-members/:storeId", authenticateToken, requireAdmin, AdminController.getStoreMemberDetails);
router.delete("/team/:memberId", authenticateToken, requireAdmin, AdminController.deleteTeamMember);
router.get("/stores/export", authenticateToken, requireAdmin, AdminController.exportStores);

router.get("/reports", authenticateToken, requireAdmin, AdminController.getReports);
router.delete("/reports/:id", authenticateToken, requireAdmin, AdminController.deleteReport);

router.get("/chats", authenticateToken, requireAdmin, AdminController.getChats);
router.get("/chats/history", authenticateToken, requireAdmin, AdminController.getChatHistory);

router.get("/settings", authenticateToken, requireAdmin, AdminController.getSettings);
router.put("/settings", authenticateToken, requireAdmin, AdminController.updateSettings);
router.post("/settings/upload", authenticateToken, requireAdmin, upload.single("image"), AdminController.uploadSettingsImage);

router.get("/complaints", authenticateToken, requireAdmin, AdminController.getComplaints);
router.put("/complaints/:id", authenticateToken, requireAdmin, AdminController.updateComplaint);
router.delete("/complaints/:id", authenticateToken, requireAdmin, AdminController.deleteComplaint);

router.get("/posts", authenticateToken, requireAdmin, AdminController.getPosts);
router.delete("/posts/:id", authenticateToken, requireAdmin, AdminController.deletePost);

router.get("/kyc", authenticateToken, requireAdmin, AdminController.getKycList);
router.put("/kyc/:id", authenticateToken, requireAdmin, AdminController.updateKycStatus);

export const adminRoutes = router;
