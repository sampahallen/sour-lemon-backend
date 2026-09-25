import { Router } from 'express'
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  deleteProductImage,
  getAdminProduct,
  getPublicProduct,
  listAdminCategories,
  listAdminProducts,
  listPublicCategories,
  listPublicProducts,
  reorderCategories,
  reorderProductImages,
  updateCategory,
  updateProduct,
  uploadProductImageController,
} from '../controllers/catalogController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { publicCache } from '../middleware/cacheControl.js'
import { productImageUpload, validateProductImageFile } from '../middleware/productImageUpload.js'
import { validateBody, validateQuery } from '../middleware/validateRequest.js'
import {
  adminProductQuerySchema,
  categoryCreateSchema,
  categoryQuerySchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  productCreateSchema,
  productImageReorderSchema,
  productImageSchema,
  productUpdateSchema,
  publicProductQuerySchema,
} from '../validators/catalogSchemas.js'

export const catalogRouter = Router()
catalogRouter.get('/categories', publicCache('standard'), listPublicCategories)
catalogRouter.get('/products', publicCache('standard'), validateQuery(publicProductQuerySchema), listPublicProducts)
catalogRouter.get('/products/:slug', publicCache('standard'), getPublicProduct)

export const categoryRouter = Router()
categoryRouter.use(authenticate, authorizeRoles('admin'))
categoryRouter.get('/', validateQuery(categoryQuerySchema), listAdminCategories)
categoryRouter.post('/', validateBody(categoryCreateSchema), createCategory)
categoryRouter.patch('/reorder', validateBody(categoryReorderSchema), reorderCategories)
categoryRouter.patch('/:categoryId', validateBody(categoryUpdateSchema), updateCategory)
categoryRouter.delete('/:categoryId', deleteCategory)

export const productRouter = Router()
productRouter.use(authenticate, authorizeRoles('admin'))
productRouter.get('/', validateQuery(adminProductQuerySchema), listAdminProducts)
productRouter.get('/:productId', getAdminProduct)
productRouter.post('/', validateBody(productCreateSchema), createProduct)
productRouter.patch('/:productId', validateBody(productUpdateSchema), updateProduct)
productRouter.delete('/:productId', deleteProduct)
productRouter.post(
  '/:productId/images',
  productImageUpload.single('file'),
  validateProductImageFile,
  validateBody(productImageSchema),
  uploadProductImageController,
)
productRouter.patch(
  '/:productId/images/reorder',
  validateBody(productImageReorderSchema),
  reorderProductImages,
)
productRouter.delete('/:productId/images/:imageId', deleteProductImage)
