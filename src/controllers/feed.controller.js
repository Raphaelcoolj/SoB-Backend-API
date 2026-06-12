import Post from '../models/Post.js';
import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';
import { getCached, setCache } from '../utils/cache.js';

export const getForYouFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, cursor = 0 } = req.query; // Cursor is now an index
    const limit = 20;
    const skip = parseInt(cursor);
    
    // Caching: `fyf:${userId}:${type || 'all'}`
    const cacheKey = `fyf:${userId}:${type || 'all'}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) return res.status(200).json(apiResponse.success('For-You-Feed retrieved (cached).', cachedData));

    // 1. Fetch user priorityFields
    const user = await User.findById(userId).select('priorityFields').lean();
    const priorityFields = user.priorityFields || [];
    
    // 2. Query two pools: Priority (last 100) and General (last 50)
    const baseQuery = { isPublished: true };
    if (type) baseQuery.contentType = type;

    const priorityQuery = { ...baseQuery, field: { $in: priorityFields } };
    const generalQuery = { ...baseQuery, field: { $nin: priorityFields } };

    const [priorityPosts, generalPosts] = await Promise.all([
      Post.find(priorityQuery).sort({ createdAt: -1 }).limit(100).populate('author', 'name username avatar').populate('field', 'name slug').lean(),
      Post.find(generalQuery).sort({ createdAt: -1 }).limit(50).populate('author', 'name username avatar').populate('field', 'name slug').lean()
    ]);

    // 3. Calculate relevance score
    const calculateScore = (post, isPriority) => {
      const ageInHours = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
      const engagementScore = (post.likes.length * 1) + (post.comments.length * 2) + (post.shares * 3);
      const fieldBoost = isPriority ? 70 : 30;
      let score = fieldBoost + engagementScore - (ageInHours * 0.5);
      if (ageInHours > 24 * 7) score -= 20;
      return score;
    };

    const scoredPosts = [
      ...priorityPosts.map(p => ({ ...p, score: calculateScore(p, true) })),
      ...generalPosts.map(p => ({ ...p, score: calculateScore(p, false) }))
    ];

    // 4. Sort and paginate
    scoredPosts.sort((a, b) => b.score - a.score);
    
    const paginatedPosts = scoredPosts.slice(skip, skip + limit);
    const nextCursor = (scoredPosts.length > skip + limit) ? (skip + limit) : null;
    
    // Strip score
    const posts = paginatedPosts.map(({ score, ...post }) => post);

    const responseData = { posts, nextCursor, hasMore: !!nextCursor };
    setCache(cacheKey, responseData, 60);
    return res.status(200).json(apiResponse.success('FYF feed fetched', responseData));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting For-You-Feed.'));
  }
};

// IMPROVED: Logic for Top 50 posts per field with weighted scoring and 1hr cache
export const getTopPostsByField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const cacheKey = `top_50_${fieldId}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) return res.status(200).json(apiResponse.success('Top posts retrieved (cached).', { posts: cachedData }));

    // Ranking Score = (impressions * 1) + (likes * 2) + (comments * 5)
    // Using aggregation for efficient scoring
    const posts = await Post.aggregate([
      { $match: { field: new mongoose.Types.ObjectId(fieldId), isPublished: true } },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$impressions", 1] },
              { $multiply: [{ $size: "$likes" }, 2] },
              { $multiply: [{ $size: "$comments" }, 5] }
            ]
          }
        }
      },
      { $sort: { score: -1, _id: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: '$author' },
      {
        $project: {
          title: 1, body: 1, mediaUrls: 1, tags: 1, score: 1, impressions: 1,
          'author.name': 1, 'author.username': 1, 'author.avatar': 1,
          likesCount: { $size: "$likes" },
          commentsCount: { $size: "$comments" }
        }
      }
    ]);

    setCache(cacheKey, posts, 3600); // Cache for 1 hour
    return res.status(200).json(apiResponse.success('Top 50 posts retrieved.', { posts }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error getting top posts.'));
  }
};

// IMPROVED: Global Discovery based on Weighted Seeding Model
export const getDiscoveryFeed = async (req, res) => {
  try {
    const cacheKey = 'discovery_feed';
    const cachedData = getCached(cacheKey);
    if (cachedData) return res.status(200).json(apiResponse.success('Discovery feed retrieved (cached).', { posts: cachedData }));

    // 1. Get field engagement (aggregate impressions)
    const fieldEngagement = await Post.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: "$field", totalImpressions: { $sum: "$impressions" } } },
      { $lookup: { from: 'fields', localField: '_id', foreignField: '_id', as: 'fieldInfo' } },
      { $unwind: '$fieldInfo' }
    ]);

    // 2. Fetch top posts from each field, apply hidden weights
    let discoveryPosts = [];
    for (const fe of fieldEngagement) {
      const fieldName = fe.fieldInfo.name;
      const seedWeight = FIELD_SEED_WEIGHTS[fieldName] || 1.0;
      
      const topPosts = await Post.find({ field: fe._id, isPublished: true })
        .sort({ impressions: -1 })
        .limit(10)
        .populate('author', 'name username avatar')
        .populate('field', 'name slug')
        .lean();

      // In-memory weight application for final sort
      const weightedPosts = topPosts.map(p => ({
        ...p,
        discoveryScore: p.impressions * seedWeight * (1 + (p.likes.length * 0.1))
      }));
      discoveryPosts.push(...weightedPosts);
    }

    discoveryPosts.sort((a, b) => b.discoveryScore - a.discoveryScore);
    discoveryPosts = discoveryPosts.slice(0, 100);

    setCache(cacheKey, discoveryPosts, 1800); // 30 min cache
    return res.status(200).json(apiResponse.success('Discovery feed retrieved.', { posts: discoveryPosts }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error getting discovery feed.'));
  }
};

export const getLatestPosts = async (req, res) => {
  try {
    const posts = await Post.find({ isPublished: true }).sort({ createdAt: -1 }).limit(20).lean();
    return res.status(200).json(apiResponse.success('Latest posts retrieved.', { posts }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting latest posts.'));
  }
};

export const getPostsByField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const posts = await Post.find({ field: fieldId, isPublished: true }).sort({ createdAt: -1 }).lean();
    return res.status(200).json(apiResponse.success('Posts by field retrieved.', { posts }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Internal server error getting posts by field.'));
  }
};
