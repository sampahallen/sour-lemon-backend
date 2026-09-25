import { randomUUID } from 'node:crypto'
import { Op, UniqueConstraintError } from 'sequelize'
import { sequelize } from '../config/database.js'
import { deleteJournalImageObject, uploadJournalImage } from '../config/storage.js'
import { JournalCategory } from '../models/JournalCategory.js'
import { JournalPost } from '../models/JournalPost.js'
import { JournalPostImage } from '../models/JournalPostImage.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { nextAvailableSlug, toDraftSlug, toSlug } from '../utils/slug.js'
import {
  JournalAdminPostQuery,
  JournalCategoryCreateInput,
  JournalCategoryReorderInput,
  JournalCategoryUpdateInput,
  JournalImageInput,
  JournalImageReorderInput,
  JournalPostCreateInput,
  JournalPostUpdateInput,
  JournalPublicPostQuery,
  JournalScheduleInput,
} from '../validators/journalSchemas.js'

const pagination = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
})

const categoryInclude = {
  model: JournalCategory,
  as: 'category',
  attributes: ['id', 'name', 'slug'],
}

const authorInclude = {
  model: User,
  as: 'author',
  attributes: ['id', 'name'],
  required: false,
}

const imageInclude = {
  model: JournalPostImage,
  as: 'images',
  required: false,
}

const requireCategory = async (categoryId: string, requireActive = false) => {
  const category = await JournalCategory.findByPk(categoryId)
  if (!category || (requireActive && !category.isActive)) {
    throw new HttpError(400, requireActive ? 'Choose an active Journal category' : 'Journal category not found')
  }
  return category
}

const requirePost = async (postId: string) => {
  const post = await JournalPost.findByPk(postId)
  if (!post) throw new HttpError(404, 'Journal post not found')
  return post
}

const generatedSlug = (preferred: string | undefined, fallback: string) => {
  const value = preferred ?? toSlug(fallback)
  if (!value) throw new HttpError(400, 'A valid slug could not be generated')
  return value
}

const isSlugCollision = (error: unknown) =>
  error instanceof UniqueConstraintError && error.errors.some((item) => item.path === 'slug')

const availableJournalCategorySlug = async (name: string, excludeId?: string) => {
  const slug = await nextAvailableSlug(name, async (candidate) => (
    await JournalCategory.unscoped().count({
      where: {
        slug: candidate,
        isDeleted: false,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
    })
  ) > 0)
  if (!slug) throw new HttpError(400, 'A valid slug could not be generated')
  return slug
}

const removeStoredImages = async (images: JournalPostImage[]) => {
  const results = await Promise.allSettled(
    images.map((image) => deleteJournalImageObject(image.storageKey)),
  )
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Unable to remove Journal image ${images[index].id} from storage`, result.reason)
    }
  })
}

export const listPublicJournalCategories = asyncHandler(async (_request, response) => {
  const categories = await JournalCategory.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  })
  response.json({ categories })
})

export const listAdminJournalCategories = asyncHandler(async (_request, response) => {
  const categories = await JournalCategory.findAll({
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  })
  response.json({ categories })
})

export const createJournalCategory = asyncHandler(async (request, response) => {
  const input = request.validatedBody as JournalCategoryCreateInput
  const maxSortOrder = await JournalCategory.max('sortOrder')
  let category: JournalCategory
  for (;;) {
    try {
      category = await JournalCategory.create({
        name: input.name,
        slug: await availableJournalCategorySlug(input.name),
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        sortOrder: typeof maxSortOrder === 'number' ? maxSortOrder + 1 : 0,
      })
      break
    } catch (error) {
      if (!isSlugCollision(error)) throw error
    }
  }
  response.status(201).json({ category })
})

export const updateJournalCategory = asyncHandler(async (request, response) => {
  const input = request.validatedBody as JournalCategoryUpdateInput
  const category = await JournalCategory.findByPk(request.params.categoryId)
  if (!category) throw new HttpError(404, 'Journal category not found')

  const nameChanged = input.name !== undefined && input.name !== category.name
  if (input.name !== undefined) category.name = input.name
  if (input.description !== undefined) category.description = input.description
  if (input.isActive !== undefined) category.isActive = input.isActive
  if (nameChanged) {
    for (;;) {
      category.slug = await availableJournalCategorySlug(category.name, category.id)
      try {
        await category.save()
        break
      } catch (error) {
        if (!isSlugCollision(error)) throw error
      }
    }
  } else {
    await category.save()
  }
  response.json({ category })
})

export const reorderJournalCategories = asyncHandler(async (request, response) => {
  const { categoryIds } = request.validatedBody as JournalCategoryReorderInput
  const categories = await JournalCategory.findAll({ attributes: ['id'] })
  const currentIds = new Set(categories.map((category) => category.id))
  if (categories.length !== categoryIds.length || categoryIds.some((id) => !currentIds.has(id))) {
    throw new HttpError(400, 'Provide every Journal category exactly once')
  }

  await sequelize.transaction(async (transaction) => {
    await Promise.all(categoryIds.map((id, sortOrder) => (
      JournalCategory.update({ sortOrder }, { where: { id }, transaction })
    )))
  })

  const reordered = await JournalCategory.findAll({
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  })
  response.json({ categories: reordered })
})

export const deleteJournalCategory = asyncHandler(async (request, response) => {
  const category = await JournalCategory.findByPk(request.params.categoryId)
  if (!category) throw new HttpError(404, 'Journal category not found')

  if (await JournalPost.count({ where: { categoryId: category.id } })) {
    throw new HttpError(409, 'Move or delete this category’s Journal posts first')
  }

  await category.update({ isDeleted: true, isActive: false })
  response.status(204).send()
})

export const listPublicJournalPosts = asyncHandler(async (request, response) => {
  const { page, limit, category } = request.validatedQuery as JournalPublicPostQuery
  const { count, rows } = await JournalPost.findAndCountAll({
    where: { status: 'published', publishedAt: { [Op.lte]: new Date() } },
    attributes: { exclude: ['body'] },
    include: [
      {
        ...categoryInclude,
        required: true,
        where: { isActive: true, ...(category ? { slug: category } : {}) },
      },
      authorInclude,
      { ...imageInclude, where: { role: 'cover' } },
    ],
    order: [['publishedAt', 'DESC']],
    distinct: true,
    limit,
    offset: (page - 1) * limit,
  })

  response.json({ posts: rows, pagination: pagination(page, limit, count) })
})

export const getPublicJournalPost = asyncHandler(async (request, response) => {
  const post = await JournalPost.findOne({
    where: {
      slug: request.params.slug,
      status: 'published',
      publishedAt: { [Op.lte]: new Date() },
    },
    include: [
      { ...categoryInclude, required: true, where: { isActive: true } },
      authorInclude,
      imageInclude,
    ],
  })
  if (!post) throw new HttpError(404, 'Journal post not found')
  response.json({ post })
})

export const listAdminJournalPosts = asyncHandler(async (request, response) => {
  const { page, limit, categoryId, status } = request.validatedQuery as JournalAdminPostQuery
  const { count, rows } = await JournalPost.findAndCountAll({
    where: { ...(categoryId ? { categoryId } : {}), ...(status ? { status } : {}) },
    attributes: { exclude: ['body'] },
    include: [categoryInclude, authorInclude, { ...imageInclude, where: { role: 'cover' } }],
    order: [['updatedAt', 'DESC']],
    distinct: true,
    limit,
    offset: (page - 1) * limit,
  })
  response.json({ posts: rows, pagination: pagination(page, limit, count) })
})

export const getAdminJournalPost = asyncHandler(async (request, response) => {
  const post = await JournalPost.findByPk(request.params.postId, {
    include: [categoryInclude, authorInclude, imageInclude],
  })
  if (!post) throw new HttpError(404, 'Journal post not found')
  response.json({ post })
})

export const createJournalPost = asyncHandler(async (request, response) => {
  const input = request.validatedBody as JournalPostCreateInput
  await requireCategory(input.categoryId)
  const postId = randomUUID()

  const post = await JournalPost.create({
    id: postId,
    categoryId: input.categoryId,
    authorUserId: request.auth!.userId,
    title: input.title,
    slug: generatedSlug(input.slug, toDraftSlug(input.title, postId)),
    excerpt: input.excerpt ?? null,
    body: input.body ?? { version: 1, blocks: [] },
    status: 'draft',
    scheduledFor: null,
    publishedAt: null,
    archivedAt: null,
  })
  response.status(201).json({ post })
})

export const updateJournalPost = asyncHandler(async (request, response) => {
  const input = request.validatedBody as JournalPostUpdateInput
  const post = await requirePost(request.params.postId)

  if (input.categoryId !== undefined) {
    await requireCategory(input.categoryId)
    post.categoryId = input.categoryId
  }
  if (input.title !== undefined) post.title = input.title
  if (input.slug !== undefined) post.slug = input.slug
  if (input.excerpt !== undefined) post.excerpt = input.excerpt
  if (input.body !== undefined) post.body = input.body

  await post.save()
  response.json({ post })
})

export const scheduleJournalPost = asyncHandler(async (request, response) => {
  const { scheduledFor } = request.validatedBody as JournalScheduleInput
  const post = await requirePost(request.params.postId)
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new HttpError(409, 'Only draft or scheduled posts can be scheduled')
  }
  await requireCategory(post.categoryId, true)

  post.status = 'scheduled'
  post.scheduledFor = scheduledFor
  post.publishedAt = null
  post.archivedAt = null
  await post.save()
  response.json({ post })
})

export const publishJournalPost = asyncHandler(async (request, response) => {
  const post = await requirePost(request.params.postId)
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new HttpError(409, 'Only draft or scheduled posts can be published')
  }
  await requireCategory(post.categoryId, true)

  post.status = 'published'
  post.scheduledFor = null
  post.publishedAt = new Date()
  post.archivedAt = null
  await post.save()
  response.json({ post })
})

export const archiveJournalPost = asyncHandler(async (request, response) => {
  const post = await requirePost(request.params.postId)
  if (post.status !== 'published') throw new HttpError(409, 'Only published posts can be archived')

  post.status = 'archived'
  post.archivedAt = new Date()
  await post.save()
  response.json({ post })
})

export const deleteJournalPost = asyncHandler(async (request, response) => {
  const post = await requirePost(request.params.postId)
  const images = await JournalPostImage.findAll({ where: { journalPostId: post.id } })
  await sequelize.transaction(async (transaction) => {
    await JournalPostImage.update(
      { isDeleted: true },
      { where: { journalPostId: post.id }, transaction },
    )
    await post.update({ isDeleted: true }, { transaction })
  })
  await removeStoredImages(images)
  response.status(204).send()
})

export const uploadJournalPostImage = asyncHandler(async (request, response) => {
  const input = request.validatedBody as JournalImageInput
  const post = await requirePost(request.params.postId)
  if (!request.file) throw new HttpError(400, 'An image file is required')

  let uploaded: { storageKey: string; url: string }
  try {
    uploaded = await uploadJournalImage(post.id, input.role, request.file)
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(502, 'The image could not be uploaded to storage')
  }

  try {
    const previousCovers = input.role === 'cover'
      ? await JournalPostImage.findAll({ where: { journalPostId: post.id, role: 'cover' } })
      : []
    const image = await sequelize.transaction(async (transaction) => {
      if (input.role === 'cover') {
        await JournalPostImage.update(
          { isDeleted: true },
          { where: { journalPostId: post.id, role: 'cover' }, transaction },
        )
      }

      return JournalPostImage.create(
        {
          journalPostId: post.id,
          role: input.role,
          url: uploaded.url,
          storageKey: uploaded.storageKey,
          altText: input.altText,
          caption: input.caption ?? null,
          sortOrder: input.sortOrder ?? 0,
          contentType: request.file!.mimetype,
          sizeBytes: request.file!.size,
        },
        { transaction },
      )
    })
    await removeStoredImages(previousCovers)
    response.status(201).json({ image })
  } catch (error) {
    try {
      await deleteJournalImageObject(uploaded.storageKey)
    } catch (cleanupError) {
      console.error('Unable to remove orphaned Journal image', cleanupError)
    }
    throw error
  }
})

export const deleteJournalPostImage = asyncHandler(async (request, response) => {
  const image = await JournalPostImage.findOne({
    where: { id: request.params.imageId, journalPostId: request.params.postId },
  })
  if (!image) throw new HttpError(404, 'Journal image not found')

  await image.update({ isDeleted: true })
  await removeStoredImages([image])
  response.status(204).send()
})

export const reorderJournalPostImages = asyncHandler(async (request, response) => {
  const { imageIds } = request.validatedBody as JournalImageReorderInput
  await requirePost(request.params.postId)

  const images = await JournalPostImage.findAll({
    where: { journalPostId: request.params.postId, role: 'body', id: imageIds },
  })
  if (images.length !== imageIds.length) {
    throw new HttpError(400, 'Every image must be an active body image belonging to this post')
  }

  await sequelize.transaction(async (transaction) => {
    await Promise.all(
      imageIds.map((imageId, sortOrder) =>
        JournalPostImage.update({ sortOrder }, { where: { id: imageId }, transaction }),
      ),
    )
  })

  const reordered = await JournalPostImage.findAll({
    where: { journalPostId: request.params.postId, role: 'body' },
    order: [['sortOrder', 'ASC']],
  })
  response.json({ images: reordered })
})
