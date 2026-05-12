import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authenticateAdminToken, requireAdmin } from "../../middlewares/auth.middleware";
import { upload, verifyAndPersistUpload } from "../../middlewares/upload.middleware";

const router = Router();

// /api/admin
// Lightweight auth-check endpoint — requires dk_admin_token, used by admin panel on load
router.get("/me", authenticateAdminToken, requireAdmin, (req: any, res: any) => {
  res.json({ id: req.user.userId, role: req.user.role });
});
router.get("/stats", authenticateAdminToken, requireAdmin, AdminController.getStats);
router.get("/users", authenticateAdminToken, requireAdmin, AdminController.getUsers);
router.post("/reset-password", authenticateAdminToken, requireAdmin, AdminController.resetPassword);
router.put("/users/:id", authenticateAdminToken, requireAdmin, AdminController.updateUser);
router.post("/users/bulk-update", authenticateAdminToken, requireAdmin, AdminController.bulkUpdateUsers);
router.delete("/users/:id", authenticateAdminToken, requireAdmin, AdminController.deleteUser);

router.get("/stores", authenticateAdminToken, requireAdmin, AdminController.getStores);
router.delete("/stores/:id", authenticateAdminToken, requireAdmin, AdminController.deleteStore);
router.get("/store-members", authenticateAdminToken, requireAdmin, AdminController.getStoreMembersList);
router.get("/store-members/:storeId", authenticateAdminToken, requireAdmin, AdminController.getStoreMemberDetails);
router.delete("/team/:memberId", authenticateAdminToken, requireAdmin, AdminController.deleteTeamMember);
router.get("/stores/export", authenticateAdminToken, requireAdmin, AdminController.exportStores);

router.get("/reports", authenticateAdminToken, requireAdmin, AdminController.getReports);
router.delete("/reports/:id", authenticateAdminToken, requireAdmin, AdminController.deleteReport);

router.get("/chats", authenticateAdminToken, requireAdmin, AdminController.getChats);
router.get("/chats/history", authenticateAdminToken, requireAdmin, AdminController.getChatHistory);

router.get("/settings", authenticateAdminToken, requireAdmin, AdminController.getSettings);
router.put("/settings", authenticateAdminToken, requireAdmin, AdminController.updateSettings);
router.post(
  "/settings/upload",
  authenticateAdminToken,
  requireAdmin,
  upload.single("image"),
  verifyAndPersistUpload,
  AdminController.uploadSettingsImage,
);

router.get("/complaints", authenticateAdminToken, requireAdmin, AdminController.getComplaints);
router.put("/complaints/:id", authenticateAdminToken, requireAdmin, AdminController.updateComplaint);
router.delete("/complaints/:id", authenticateAdminToken, requireAdmin, AdminController.deleteComplaint);

router.get("/posts", authenticateAdminToken, requireAdmin, AdminController.getPosts);
router.delete("/posts/:id", authenticateAdminToken, requireAdmin, AdminController.deletePost);

router.get("/kyc", authenticateAdminToken, requireAdmin, AdminController.getKycList);
router.put("/kyc/:id", authenticateAdminToken, requireAdmin, AdminController.updateKycStatus);

export const adminRoutes = router;
