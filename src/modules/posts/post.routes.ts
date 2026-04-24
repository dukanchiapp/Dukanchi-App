import { Router } from "express";
import { PostController } from "./post.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { createPostSchema, updatePostSchema } from "../../../validators/schemas";

const router = Router();

// /api/posts
router.post("/", authenticateToken, validate(createPostSchema), PostController.createPost);
router.get("/", authenticateToken, PostController.getFeed);
router.post("/:id/like", authenticateToken, PostController.toggleLike);
router.post("/:id/save", authenticateToken, PostController.toggleSave);
router.post("/:id/pin", authenticateToken, PostController.togglePin);
router.put("/:id", authenticateToken, validate(updatePostSchema), PostController.updatePost);
router.delete("/:id", authenticateToken, PostController.deletePost);

export const postRoutes = router;

// /api/me/interactions
export const interactionsRouter = Router();
interactionsRouter.get("/", authenticateToken, PostController.getInteractions);

// /api/stores/:storeId/posts (DELETE) -> Mounted at /api/stores in app.ts or exported here to be mounted
export const storePostsDeleteRouter = Router({ mergeParams: true });
storePostsDeleteRouter.delete("/", authenticateToken, PostController.deleteAllStorePosts);
