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
  reorderProductImages,
  updateCategory,
  updateProduct,
  uploadProductImageController,
} from '../controllers/catalogController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { productImageUpload, validateProductImageFile } from '../middleware/productImageUpload.js'
import { validateBody, validateQuery } from '../middleware/validateRequest.js'
import {
  adminProductQuerySchema,
  categoryCreateSchema,
  categoryQuerySchema,
  categoryUpdateSchema,
  productCreateSchema,
  productImageReorderSchema,
  productImageSchema,
  productUpdateSchema,
  publicProductQuerySchema,
} from '../validators/catalogSchemas.js'

export const catalogRouter = Router()
catalogRouter.get('/categories', listPublicCategories)
catalogRouter.get('/products', validateQuery(publicProductQuerySchema), listPublicProducts)
catalogRouter.get('/products/:slug', getPublicProduct)

export const categoryRouter = Router()
categoryRouter.use(authenticate, authorizeRoles('admin'))
categoryRouter.get('/', validateQuery(categoryQuerySchema), listAdminCategories)
categoryRouter.post('/', validateBody(categoryCreateSchema), createCategory)
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
