import { Router } from "express";
import { StoreController } from "./store.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { createStoreSchema } from "../../../validators/schemas";

const router = Router();

// /api/stores
router.post("/", authenticateToken, validate(createStoreSchema), StoreController.createStore);
router.get("/", StoreController.getStores);
router.get("/:id", StoreController.getStoreById);
router.put("/:id", authenticateToken, StoreController.updateStore);
router.post("/:id/follow", authenticateToken, StoreController.toggleFollow);
router.get("/:id/posts", StoreController.getStorePosts);

// /api/pincode
const pincodeRouter = Router();
pincodeRouter.get("/:code", StoreController.getPincodeInfo);

// /api/products
const productRouter = Router();
productRouter.post("/", authenticateToken, StoreController.createProduct);
productRouter.get("/", StoreController.getProducts);

export { router as storeRoutes, pincodeRouter, productRouter };
