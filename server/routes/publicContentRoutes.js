'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const publicContentController = require('../controllers/publicContentController');
const {
  createRateLimitStore,
  shouldPassOnRateLimitStoreError,
} = require('../middleware/rateLimitRedisStore');

const router = express.Router();

function publicLimiter(name, max) {
  const windowMs = 60 * 1000;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRateLimitStore({
      prefix: `arivu:public-content:${name}:`,
      windowMs,
    }),
    passOnStoreError: shouldPassOnRateLimitStoreError(process.env.RATE_LIMIT_REDIS_FAILURE_MODE),
  });
}

const publicContentLimiter = publicLimiter('content', 120);
const publicRenderLimiter = publicLimiter('render', 60);
const publicFeedbackLimiter = publicLimiter('feedback', 30);

router.post('/render-blocks', publicRenderLimiter, publicContentController.renderPublicBlocks);

router.get('/:orgSlug/manifest.json', publicContentLimiter, publicContentController.getPublicHelpManifest);
router.get('/:orgSlug/export/home', publicContentLimiter, publicContentController.getPublicHelpHomeExport);
router.get('/:orgSlug/export/sitemap.xml', publicContentLimiter, publicContentController.getPublicHelpStaticSitemapExport);
router.get('/:orgSlug/export/collections/:slug', publicContentLimiter, publicContentController.getPublicHelpCollectionExport);
router.get('/:orgSlug/sitemap.xml', publicContentLimiter, publicContentController.getPublicHelpSitemap);
router.get('/:orgSlug/assets/:assetId', publicContentLimiter, publicContentController.downloadPublicHelpAsset);
router.get('/:orgSlug/collections', publicContentLimiter, publicContentController.listPublicHelpCollections);
router.get('/:orgSlug/articles/recent', publicContentLimiter, publicContentController.listPublicRecentHelpArticles);
router.get('/:orgSlug/articles/popular', publicContentLimiter, publicContentController.listPublicPopularHelpArticles);
router.get('/:orgSlug/articles/:slug/export', publicContentLimiter, publicContentController.getPublicHelpArticleExport);
router.get('/:orgSlug/help/recent', publicContentLimiter, publicContentController.listPublicRecentHelpArticles);
router.get('/:orgSlug/help/popular', publicContentLimiter, publicContentController.listPublicPopularHelpArticles);
router.get('/:orgSlug/help', publicContentLimiter, publicContentController.listPublicHelpArticles);
router.get('/:orgSlug/help/:slug', publicContentLimiter, publicContentController.getPublicHelpArticle);
router.get('/:orgSlug/articles', publicContentLimiter, publicContentController.listPublicHelpArticles);
router.post(
  '/:orgSlug/articles/:slug/feedback',
  publicFeedbackLimiter,
  publicContentController.submitPublicArticleFeedback,
);
router.get('/:orgSlug/articles/:slug', publicContentLimiter, publicContentController.getPublicHelpArticle);

router.get('/:orgSlug/blog/rss.xml', publicContentLimiter, publicContentController.getPublicBlogRss);
router.get('/:orgSlug/blog/collections/:slug/rss.xml', publicContentLimiter, publicContentController.getPublicBlogCollectionRss);
router.get('/:orgSlug/blog/manifest.json', publicContentLimiter, publicContentController.getPublicBlogManifest);
router.get('/:orgSlug/blog/export/home', publicContentLimiter, publicContentController.getPublicBlogHomeExport);
router.get('/:orgSlug/blog/export/sitemap.xml', publicContentLimiter, publicContentController.getPublicBlogStaticSitemapExport);
router.get('/:orgSlug/blog/export/collections/:slug', publicContentLimiter, publicContentController.getPublicBlogCollectionExport);
router.get('/:orgSlug/blog/recent', publicContentLimiter, publicContentController.listPublicRecentBlogPosts);
router.get('/:orgSlug/blog/popular', publicContentLimiter, publicContentController.listPublicPopularBlogPosts);
router.get('/:orgSlug/blog/sitemap.xml', publicContentLimiter, publicContentController.getPublicBlogSitemap);
router.get('/:orgSlug/blog/collections', publicContentLimiter, publicContentController.listPublicBlogCollections);
router.get('/:orgSlug/blog/:slug/export', publicContentLimiter, publicContentController.getPublicBlogPostExport);
router.get('/:orgSlug/blog/:slug/rss.xml', publicContentLimiter, publicContentController.getPublicBlogPostRss);
router.post(
  '/:orgSlug/blog/:slug/feedback',
  publicFeedbackLimiter,
  publicContentController.submitPublicBlogFeedback,
);
router.get('/:orgSlug/blog', publicContentLimiter, publicContentController.listPublicBlogPosts);
router.get('/:orgSlug/blog/:slug', publicContentLimiter, publicContentController.getPublicBlogPost);

module.exports = router;
