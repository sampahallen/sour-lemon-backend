import { Op } from 'sequelize'
import { deleteProductImageObject, uploadProductImage } from '../config/storage.js'
import { sequelize } from '../config/database.js'
import { AppSetting } from '../models/AppSetting.js'
import { Category } from '../models/Category.js'
import { Product } from '../models/Product.js'
import { ProductImage } from '../models/ProductImage.js'
import { SiteSection } from '../models/SiteSection.js'
import type {
  AdminProductQuery,
  CategoryCreateInput,
  CategoryQuery,
  CategoryUpdateInput,
  ProductCreateInput,
  ProductImageInput,
  ProductImageReorderInput,
  ProductUpdateInput,
  PublicProductQuery,
} from '../validators/catalogSchemas.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HttpError } from '../utils/HttpError.js'
import { toSlug } from '../utils/slug.js'

const categoryInclude = {
  model: Category,
  as: 'category',
  attributes: ['id', 'name', 'slug'],
}

const imageInclude = {
  model: ProductImage,
  as: 'images',
  required: false,
}

const generatedSlug = (preferred: string | undefined, fallback: string) => {
  const value = preferred ?? toSlug(fallback)
  if (!value) throw new HttpError(400, 'A valid slug could not be generated')
  return value
}

const serializeProduct = (product: Product) => {
  const raw = product.toJSON() as Record<string, unknown>
  const images = Array.isArray(raw.images)
    ? [...raw.images].sort((left, right) => {
        const leftOrder = Number((left as Record<string, unknown>).sortOrder ?? 0)
        const rightOrder = Number((right as Record<string, unknown>).sortOrder ?? 0)
        return leftOrder - rightOrder
      })
    : []
  const cover = images[0] as Record<string, unknown> | undefined
  return { ...raw, images, coverImageUrl: typeof cover?.url === 'string' ? cover.url : null }
}

const requireCategory = async (categoryId: string) => {
  const category = await Category.findByPk(categoryId)
  if (!category) throw new HttpError(400, 'Category not found')
  return category
}

const requireProduct = async (productId: string) => {
  const product = await Product.findByPk(productId)
  if (!product) throw new HttpError(404, 'Product not found')
  return product
}

const detailedProduct = async (productId: string) => {
  const product = await Product.findByPk(productId, {
    include: [categoryInclude, imageInclude],
    order: [[{ model: ProductImage, as: 'images' }, 'sortOrder', 'ASC']],
  })
  if (!product) throw new HttpError(404, 'Product not found')
  return serializeProduct(product)
}

export const listAdminCategories = asyncHandler(async (request, response) => {
  const { siteSectionId, sectionKey } = request.validatedQuery as CategoryQuery
  const siteSection = sectionKey
    ? await SiteSection.findOne({ where: { key: sectionKey }, attributes: ['id', 'key', 'name'] })
    : null
  const categories = await Category.findAll({
    where: { ...(siteSectionId ? { siteSectionId } : {}) },
    include: sectionKey
      ? [{ model: SiteSection, as: 'siteSection', attributes: [], required: true, where: { key: sectionKey } }]
      : [],
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  })
  response.json({ categories, siteSection })
})

export const createCategory = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CategoryCreateInput
  const section = await SiteSection.findByPk(input.siteSectionId)
  if (!section) throw new HttpError(400, 'Site section not found')
  const category = await Category.create({
    siteSectionId: input.siteSectionId,
    name: input.name,
    slug: generatedSlug(input.slug, input.name),
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
  })
  response.status(201).json({ category })
})

export const updateCategory = asyncHandler(async (request, response) => {
  const input = request.validatedBody as CategoryUpdateInput
  const category = await Category.findByPk(request.params.categoryId)
  if (!category) throw new HttpError(404, 'Category not found')
  if (input.siteSectionId !== undefined) {
    const section = await SiteSection.findByPk(input.siteSectionId)
    if (!section) throw new HttpError(400, 'Site section not found')
    category.siteSectionId = input.siteSectionId
  }
  if (input.name !== undefined) category.name = input.name
  if (input.slug !== undefined) category.slug = input.slug
  if (input.isActive !== undefined) category.isActive = input.isActive
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder
  await category.save()
  response.json({ category })
})

export const deleteCategory = asyncHandler(async (request, response) => {
  const category = await Category.findByPk(request.params.categoryId)
  if (!category) throw new HttpError(404, 'Category not found')
  if (await Product.count({ where: { categoryId: category.id } })) {
    throw new HttpError(409, 'Move or delete this category’s products first')
  }
  await category.update({ isDeleted: true, isActive: false })
  response.status(204).send()
})

export const listPublicCategories = asyncHandler(async (_request, response) => {
  const categories = await Category.findAll({
    where: { isActive: true },
    include: [{
      model: SiteSection,
      as: 'siteSection',
      attributes: [],
      required: true,
      where: { key: 'cakes', isEnabled: true },
    }],
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  })
  response.json({ categories })
})

export const listAdminProducts = asyncHandler(async (request, response) => {
  const { categoryId, includeInactive } = request.validatedQuery as AdminProductQuery
  const products = await Product.findAll({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: [categoryInclude, imageInclude],
    order: [['name', 'ASC']],
  })
  response.json({ products: products.map(serializeProduct) })
})

export const getAdminProduct = asyncHandler(async (request, response) => {
  response.json({ product: await detailedProduct(request.params.productId) })
})

export const createProduct = asyncHandler(async (request, response) => {
  const input = request.validatedBody as ProductCreateInput
  await requireCategory(input.categoryId)
  const product = await Product.create({
    categoryId: input.categoryId,
    name: input.name,
    slug: generatedSlug(input.slug, input.name),
    description: input.description ?? null,
    price: input.price.toFixed(2),
    currency: input.currency ?? 'GHS',
    isActive: input.isActive ?? true,
    availableFrom: input.availableFrom ?? null,
    availableUntil: input.availableUntil ?? null,
    archivedAt: null,
  })
  response.status(201).json({ product: await detailedProduct(product.id) })
})

export const updateProduct = asyncHandler(async (request, response) => {
  const input = request.validatedBody as ProductUpdateInput
  const product = await requireProduct(request.params.productId)
  if (input.categoryId !== undefined) {
    await requireCategory(input.categoryId)
    product.categoryId = input.categoryId
  }
  if (input.name !== undefined) product.name = input.name
  if (input.slug !== undefined) product.slug = input.slug
  if (input.description !== undefined) product.description = input.description
  if (input.price !== undefined) product.price = input.price.toFixed(2)
  if (input.currency !== undefined) product.currency = input.currency
  if (input.isActive !== undefined) product.isActive = input.isActive
  if (input.availableFrom !== undefined) product.availableFrom = input.availableFrom
  if (input.availableUntil !== undefined) product.availableUntil = input.availableUntil
  await product.save()
  response.json({ product: await detailedProduct(product.id) })
})

export const deleteProduct = asyncHandler(async (request, response) => {
  const product = await requireProduct(request.params.productId)
  const images = await ProductImage.findAll({ where: { productId: product.id } })
  await sequelize.transaction(async (transaction) => {
    await ProductImage.update({ isDeleted: true }, { where: { productId: product.id }, transaction })
    await product.update({ isDeleted: true, isActive: false }, { transaction })
  })
  await Promise.allSettled(images.map((image) => deleteProductImageObject(image.storageKey)))
  response.status(204).send()
})

const publicProductWhere = async () => {
  const setting = await AppSetting.findByPk('menu_scheduling_enabled')
  const schedulingEnabled = (setting?.value as unknown) === true
  if (!schedulingEnabled) return { isActive: true, archivedAt: null }
  const now = new Date()
  return {
    isActive: true,
    archivedAt: null,
    [Op.and]: [
      { [Op.or]: [{ availableFrom: null }, { availableFrom: { [Op.lte]: now } }] },
      { [Op.or]: [{ availableUntil: null }, { availableUntil: { [Op.gt]: now } }] },
    ],
  }
}

export const listPublicProducts = asyncHandler(async (request, response) => {
  const { category, limit } = request.validatedQuery as PublicProductQuery
  const products = await Product.findAll({
    where: await publicProductWhere(),
    include: [
      {
        ...categoryInclude,
        required: true,
        where: { isActive: true, ...(category ? { slug: category } : {}) },
        include: [{
          model: SiteSection,
          as: 'siteSection',
          attributes: [],
          required: true,
          where: { key: 'cakes', isEnabled: true },
        }],
      },
      imageInclude,
    ],
    order: [['name', 'ASC']],
    limit,
  })
  response.json({ products: products.map(serializeProduct) })
})

export const getPublicProduct = asyncHandler(async (request, response) => {
  const product = await Product.findOne({
    where: { ...(await publicProductWhere()), slug: request.params.slug },
    include: [
      {
        ...categoryInclude,
        required: true,
        where: { isActive: true },
        include: [{
          model: SiteSection,
          as: 'siteSection',
          attributes: [],
          required: true,
          where: { key: 'cakes', isEnabled: true },
        }],
      },
      imageInclude,
    ],
  })
  if (!product) throw new HttpError(404, 'Product not found')
  response.json({ product: serializeProduct(product) })
})

export const uploadProductImageController = asyncHandler(async (request, response) => {
  const input = request.validatedBody as ProductImageInput
  const product = await requireProduct(request.params.productId)
  const uploaded = await uploadProductImage(product.id, request.file!)
  try {
    const maxSortOrder = await ProductImage.max('sortOrder', { where: { productId: product.id } })
    const image = await ProductImage.create({
      productId: product.id,
      url: uploaded.url,
      storageKey: uploaded.storageKey,
      altText: input.altText,
      sortOrder: typeof maxSortOrder === 'number' ? maxSortOrder + 1 : 0,
    })
    response.status(201).json({ image })
  } catch (error) {
    await deleteProductImageObject(uploaded.storageKey).catch(() => undefined)
    throw error
  }
})

export const deleteProductImage = asyncHandler(async (request, response) => {
  const image = await ProductImage.findOne({
    where: { id: request.params.imageId, productId: request.params.productId },
  })
  if (!image) throw new HttpError(404, 'Product image not found')
  await image.update({ isDeleted: true })
  await deleteProductImageObject(image.storageKey)
  response.status(204).send()
})

export const reorderProductImages = asyncHandler(async (request, response) => {
  const { imageIds } = request.validatedBody as ProductImageReorderInput
  await requireProduct(request.params.productId)
  const images = await ProductImage.findAll({ where: { productId: request.params.productId } })
  if (images.length !== imageIds.length || images.some((image) => !imageIds.includes(image.id))) {
    throw new HttpError(400, 'Provide every active product image exactly once')
  }
  await sequelize.transaction(async (transaction) => {
    await Promise.all(
      imageIds.map((imageId, sortOrder) =>
        ProductImage.update({ sortOrder }, { where: { id: imageId }, transaction }),
      ),
    )
  })
  const reordered = await ProductImage.findAll({
    where: { productId: request.params.productId },
    order: [['sortOrder', 'ASC']],
  })
  response.json({ images: reordered })
})
