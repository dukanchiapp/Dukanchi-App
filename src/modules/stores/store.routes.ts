import { Router } from "express";
import multer from "multer";
import path from "path";
import { StoreController } from "./store.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { validate } from "../../../validators/validate";
import { createStoreSchema } from "../../../validators/schemas";

// Memory-storage multer for bulk import — spreadsheets processed in-memory, not saved to disk
const xlsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
  },
});

const router = Router();

// /api/stores
router.post("/", authenticateToken, validate(createStoreSchema), StoreController.createStore);
router.get("/", authenticateToken, StoreController.getStores);
router.get("/:id", authenticateToken, StoreController.getStoreById);
router.put("/:id", authenticateToken, StoreController.updateStore);
router.post("/:id/follow", authenticateToken, StoreController.toggleFollow);
router.get("/:id/posts", authenticateToken, StoreController.getStorePosts);
router.post("/:storeId/bulk-import", authenticateToken, xlsUpload.single("file"), StoreController.bulkImport);

// /api/pincode
const pincodeRouter = Router();
pincodeRouter.get("/:code", StoreController.getPincodeInfo);

// /api/products
const productRouter = Router();
productRouter.post("/", authenticateToken, StoreController.createProduct);
productRouter.get("/", authenticateToken, StoreController.getProducts);

export { router as storeRoutes, pincodeRouter, productRouter };
