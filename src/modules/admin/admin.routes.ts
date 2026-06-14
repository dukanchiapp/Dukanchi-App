import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authenticateAdminToken, requireAdmin } from "../../middlewares/auth.middleware";
import { upload, verifyAndPersistUpload } from "../../middlewares/upload.middleware";
import { uploadLimiter } from "../../middlewares/rate-limiter.middleware";
import { validate, validateQuery, validateParams } from "../../../validators/validate";
import {
  idParamSchema,
  adminListUsersQuery,
  adminResetPasswordBody,
  adminUpdateUserBody,
  adminBulkUpdateUsersBody,
  adminListStoresQuery,
  adminGetStoreMembersQuery,
  adminStoreIdParam,
  adminMemberIdParam,
  adminListReportsQuery,
  adminListChatsQuery,
  adminChatHistoryQuery,
  adminUpdateSettingsBody,
  adminListComplaintsQuery,
  adminUpdateComplaintBody,
  adminListPostsQuery,
  adminListKycQuery,
  adminUpdateKycBody,
} from "../../../validators/schemas";

const router = Router();

// /api/admin
// Session 128.37: every route below the auth gate also runs through the
// matching validate/validateQuery/validateParams middleware (Path A — same
// pattern as #185). The privilege-write routes (PUT /users/:id, bulk-update,
// /complaints/:id, /kyc/:id, /settings, /reset-password) are strict-allowlist
// schemas so unknown body keys can't reach the Prisma layer via mass-
// assignment. POST /settings/upload is multipart-only — multer + the existing
// verifyAndPersistUpload chain validates the file; no JSON body schema runs.

// Lightweight auth-check endpoint — requires dk_admin_token, used by admin panel on load
router.get("/me", authenticateAdminToken, requireAdmin, (req: any, res: any) => {
  res.json({ id: req.user.userId, role: req.user.role });
});
router.get("/stats", authenticateAdminToken, requireAdmin, AdminController.getStats);
router.get("/users", authenticateAdminToken, requireAdmin, validateQuery(adminListUsersQuery), AdminController.getUsers);
router.post("/reset-password", authenticateAdminToken, requireAdmin, validate(adminResetPasswordBody), AdminController.resetPassword);
router.put("/users/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), validate(adminUpdateUserBody), AdminController.updateUser);
router.post("/users/bulk-update", authenticateAdminToken, requireAdmin, validate(adminBulkUpdateUsersBody), AdminController.bulkUpdateUsers);
router.delete("/users/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), AdminController.deleteUser);

router.get("/stores", authenticateAdminToken, requireAdmin, validateQuery(adminListStoresQuery), AdminController.getStores);
router.delete("/stores/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), AdminController.deleteStore);
router.get("/store-members", authenticateAdminToken, requireAdmin, validateQuery(adminGetStoreMembersQuery), AdminController.getStoreMembersList);
router.get("/store-members/:storeId", authenticateAdminToken, requireAdmin, validateParams(adminStoreIdParam), AdminController.getStoreMemberDetails);
router.delete("/team/:memberId", authenticateAdminToken, requireAdmin, validateParams(adminMemberIdParam), AdminController.deleteTeamMember);
router.get("/stores/export", authenticateAdminToken, requireAdmin, AdminController.exportStores);

router.get("/reports", authenticateAdminToken, requireAdmin, validateQuery(adminListReportsQuery), AdminController.getReports);
router.delete("/reports/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), AdminController.deleteReport);

router.get("/chats", authenticateAdminToken, requireAdmin, validateQuery(adminListChatsQuery), AdminController.getChats);
router.get("/chats/history", authenticateAdminToken, requireAdmin, validateQuery(adminChatHistoryQuery), AdminController.getChatHistory);

router.get("/settings", authenticateAdminToken, requireAdmin, AdminController.getSettings);
router.put("/settings", authenticateAdminToken, requireAdmin, validate(adminUpdateSettingsBody), AdminController.updateSettings);
router.post(
  "/settings/upload",
  authenticateAdminToken,
  requireAdmin,
  // Day 2.6 Item 2: uploadLimiter (10/min Redis-backed) — admin already has
  // strong auth, but if an admin cookie ever leaks, this caps damage at
  // 10 uploads/min instead of 300 (generalLimiter ceiling).
  uploadLimiter,
  upload.single("image"),
  verifyAndPersistUpload,
  AdminController.uploadSettingsImage,
);

router.get("/complaints", authenticateAdminToken, requireAdmin, validateQuery(adminListComplaintsQuery), AdminController.getComplaints);
router.put("/complaints/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), validate(adminUpdateComplaintBody), AdminController.updateComplaint);
router.delete("/complaints/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), AdminController.deleteComplaint);

router.get("/posts", authenticateAdminToken, requireAdmin, validateQuery(adminListPostsQuery), AdminController.getPosts);
router.delete("/posts/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), AdminController.deletePost);

router.get("/kyc", authenticateAdminToken, requireAdmin, validateQuery(adminListKycQuery), AdminController.getKycList);
router.put("/kyc/:id", authenticateAdminToken, requireAdmin, validateParams(idParamSchema), validate(adminUpdateKycBody), AdminController.updateKycStatus);

export const adminRoutes = router;
