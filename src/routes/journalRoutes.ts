import { Router } from 'express'
import {
  archiveJournalPost,
  createJournalCategory,
  createJournalPost,
  deleteJournalCategory,
  deleteJournalPost,
  deleteJournalPostImage,
  getAdminJournalPost,
  getPublicJournalPost,
  listAdminJournalCategories,
  listAdminJournalPosts,
  listPublicJournalCategories,
  listPublicJournalPosts,
  publishJournalPost,
  reorderJournalCategories,
  reorderJournalPostImages,
  scheduleJournalPost,
  updateJournalCategory,
  updateJournalPost,
  uploadJournalPostImage,
} from '../controllers/journalController.js'
import { authenticate, authorizeRoles } from '../middleware/authMiddleware.js'
import { publicCache } from '../middleware/cacheControl.js'
import { journalImageUpload, validateJournalImageFile } from '../middleware/journalImageUpload.js'
import { validateBody, validateQuery } from '../middleware/validateRequest.js'
import {
  journalAdminPostQuerySchema,
  journalCategoryCreateSchema,
  journalCategoryReorderSchema,
  journalCategoryUpdateSchema,
  journalImageReorderSchema,
  journalImageSchema,
  journalPostCreateSchema,
  journalPostUpdateSchema,
  journalPublicPostQuerySchema,
  journalScheduleSchema,
} from '../validators/journalSchemas.js'

export const journalRouter = Router()

journalRouter.get('/categories', publicCache('journal'), listPublicJournalCategories)
journalRouter.get('/posts', publicCache('journal'), validateQuery(journalPublicPostQuerySchema), listPublicJournalPosts)
journalRouter.get('/posts/:slug', publicCache('journal'), getPublicJournalPost)

journalRouter.use(authenticate, authorizeRoles('admin'))

journalRouter.get('/admin/categories', listAdminJournalCategories)
journalRouter.post('/categories', validateBody(journalCategoryCreateSchema), createJournalCategory)
journalRouter.patch(
  '/categories/reorder',
  validateBody(journalCategoryReorderSchema),
  reorderJournalCategories,
)
journalRouter.patch(
  '/categories/:categoryId',
  validateBody(journalCategoryUpdateSchema),
  updateJournalCategory,
)
journalRouter.delete('/categories/:categoryId', deleteJournalCategory)

journalRouter.get('/admin/posts', validateQuery(journalAdminPostQuerySchema), listAdminJournalPosts)
journalRouter.get('/admin/posts/:postId', getAdminJournalPost)
journalRouter.post('/posts', validateBody(journalPostCreateSchema), createJournalPost)
journalRouter.patch('/posts/:postId', validateBody(journalPostUpdateSchema), updateJournalPost)
journalRouter.delete('/posts/:postId', deleteJournalPost)
journalRouter.post(
  '/posts/:postId/schedule',
  validateBody(journalScheduleSchema),
  scheduleJournalPost,
)
journalRouter.post('/posts/:postId/publish', publishJournalPost)
journalRouter.post('/posts/:postId/archive', archiveJournalPost)
journalRouter.post(
  '/posts/:postId/images',
  journalImageUpload.single('file'),
  validateJournalImageFile,
  validateBody(journalImageSchema),
  uploadJournalPostImage,
)
journalRouter.patch(
  '/posts/:postId/images/reorder',
  validateBody(journalImageReorderSchema),
  reorderJournalPostImages,
)
journalRouter.delete('/posts/:postId/images/:imageId', deleteJournalPostImage)
