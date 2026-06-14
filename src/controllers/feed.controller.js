import Post from '../models/Post.js';
import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';
import { getCached, setCache } from '../utils/cache.js';
import mongoose from 'mongoose';

const FIELD_SEED_WEIGHTS = {
  // Example weights
  'Technology': 1.2,
  'Science': 1.1,
  'General': 1.0
};

export const getForYouFeed = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, cursor = 0 } = req.query;
    const limit = 20;
    const skip = parseInt(cursor);
    
    const user = await User.findById(userId).select('priorityFields following').lean();
    const priorityFields = user.priorityFields || [];
    const followingIds = (user.following || []).map(id => id.toString());
    
    const matchQuery = { 
      isPublished: true,
      $or: [
        { field: { $exists: true } },
        { field: null, contentType: 'post' } // include fieldless short posts
      ]
    };
    if (type) matchQuery.contentType = type;

    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'fields',
          localField: 'field',
          foreignField: '_id',
          as: 'fieldData'
        }
      },
      { $unwind: { path: '$fieldData', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          ageInHours: { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 3600000] },
          likesCount: { $size: { $ifNull: ["$likes", []] } },
          commentsCount: { $size: { $ifNull: ["$comments", []] } },
          isPriority: { $in: ["$field", priorityFields] },
          isFollowedAuthor: { $in: ["$author", followingIds.map(id => new mongoose.Types.ObjectId(id))] },
          randomFactor: { $rand: {} } // Add a random factor for variety
        }
      },
      {
        $addFields: {
          fieldBoost: {
            $multiply: [
              {
                $cond: {
                  if: { $eq: ["$field", null] },
                  then: 20, // fieldless short posts get flat boost
                  else: {
                    $cond: {
                      if: "$isPriority",
                      then: 70,
                      else: 30
                    }
                  }
                }
              },
              { $ifNull: ["$fieldData.boostWeight", 1.0] } // NEW: multiply by admin-set boost
            ]
          }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$likesCount", 1] },
              { $multiply: ["$commentsCount", 2] },
              { $multiply: ["$shares", 3] },
              { $multiply: ["$impressions", 0.01] },
              { $max: [0, { $subtract: [50, "$ageInHours"] }] }, // timeBoost
              "$fieldBoost", // use computed fieldBoost
              { $cond: { if: "$isFollowedAuthor", then: 50, else: 0 } }, // NEW: followed author boost
              { $multiply: ["$randomFactor", 20] }, // Small random boost
              { $cond: { if: { $eq: ["$contentType", "article"] }, then: 10, else: 5 } } // contentTypeBoost
            ]
          }
        }
      },
      { $sort: { score: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit + 1 }, // Fetch 1 extra to check for hasMore
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: '$author' },
      // Reuse the already looked up fieldData for the final response
      {
        $addFields: {
          field: "$fieldData"
        }
      },
      { $project: { fieldData: 0 } }
    ];

    const results = await Post.aggregate(pipeline);
    
    const hasMore = results.length > limit;
    const rawPosts = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? skip + limit : null;

    // FIXED: Add isFollowing flag to authors and include badges
    const posts = rawPosts.map(post => {
      const author = post.author;
      if (!author) return post;
      
      return {
        ...post,
        author: {
          ...author,
          isFollowing: author.followers?.some(
            (fId) => fId.toString() === userId.toString()
          ) || false,
          followers: undefined, // Clean up sensitive data
          password: undefined,
          refreshToken: undefined,
          email: undefined
        }
      };
    });

    return res.status(200).json(apiResponse.success('For-You-Feed retrieved.', { posts, nextCursor, hasMore }));
  } catch (error) {
    console.error('FYF Aggregation Error:', error);
    return res.status(500).json(apiResponse.error('Internal server error getting For-You-Feed.'));
  }
};

export const getTopPostsByField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const cacheKey = `top_posts_${fieldId}`;
    const cachedData = getCached(cacheKey);
    if (cachedData) return res.status(200).json(apiResponse.success('Top posts retrieved (cached).', { posts: cachedData }));

    // Removed hard limit; fetches up to 100 posts, but can handle fewer gracefully
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
      { $limit: 100 }, 
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

    setCache(cacheKey, posts, 3600);
    return res.status(200).json(apiResponse.success('Top posts retrieved.', { posts }));
  } catch (error) {
    return res.status(500).json(apiResponse.error('Error getting top posts.'));
  }
};

export const getDiscoveryFeed = async (req, res) => {
  try {
    const cacheKey = 'discovery_feed';
    const cachedData = getCached(cacheKey);
    if (cachedData) return res.status(200).json(apiResponse.success('Discovery feed retrieved (cached).', { posts: cachedData }));

    const fieldEngagement = await Post.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: "$field", totalImpressions: { $sum: "$impressions" } } },
      { $lookup: { from: 'fields', localField: '_id', foreignField: '_id', as: 'fieldInfo' } },
      { $unwind: '$fieldInfo' }
    ]);

    let discoveryPosts = [];
    for (const fe of fieldEngagement) {
      const fieldName = fe.fieldInfo.name;
      const seedWeight = FIELD_SEED_WEIGHTS[fieldName] || 1.0;
      
      // Fetch posts for the field, limit is now per-field to ensure diversity
      const topPosts = await Post.find({ field: fe._id, isPublished: true })
        .sort({ impressions: -1 })
        .limit(20) 
        .populate('author', 'name username avatar')
        .populate('field', 'name slug')
        .lean();

      const weightedPosts = topPosts.map(p => ({
        ...p,
        discoveryScore: p.impressions * seedWeight * (1 + (p.likes.length * 0.1))
      }));
      discoveryPosts.push(...weightedPosts);
    }

    discoveryPosts.sort((a, b) => b.discoveryScore - a.discoveryScore);
    // Removed absolute 100 limit, returning up to 200 or whatever is found
    discoveryPosts = discoveryPosts.slice(0, 200);

    setCache(cacheKey, discoveryPosts, 1800);
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

// NEW: discover feed for a specific field - shuffled mix of recent + high-impression posts
export const getFieldDiscoverFeed = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { cursor = 0 } = req.query;
    const limit = 20;
    const skip = parseInt(cursor);

    const cacheKey = `discover:${fieldId}:${skip}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.status(200).json(apiResponse.success('Discover feed retrieved (cached)', cached));
    }

    const pipeline = [
      { 
        $match: { 
          field: new mongoose.Types.ObjectId(fieldId), 
          isPublished: true 
        } 
      },
      {
        $addFields: {
          ageInHours: { 
            $divide: [{ $subtract: [new Date(), "$createdAt"] }, 3600000] 
          },
          randomFactor: { $rand: {} }
        }
      },
      {
        $addFields: {
          // NEW: discover score blends recency, impressions, and randomness
          discoverScore: {
            $add: [
              // Recency boost - decays over 7 days
              { $max: [0, { $subtract: [100, { $multiply: ["$ageInHours", 0.6] }] }] },
              // Impressions boost
              { $multiply: [{ $ifNull: ["$impressions", 0] }, 0.05] },
              // Engagement boost
              { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 2] },
              { $multiply: [{ $size: { $ifNull: ["$comments", []] } }, 3] },
              // Randomization - keeps feed fresh on every visit
              { $multiply: ["$randomFactor", 40] }
            ]
          }
        }
      },
      { $sort: { discoverScore: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit + 1 },
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
          title: 1, body: 1, contentType: 1, media: 1, 
          likes: 1, comments: 1, shares: 1, bookmarks: 1,
          createdAt: 1, impressions: 1,
          'author._id': 1, 'author.name': 1, 'author.username': 1, 
          'author.avatar': 1, 'author.earlyAdopter': 1, 'author.founderBadge': 1
        }
      }
    ];

    const results = await Post.aggregate(pipeline);

    const hasMore = results.length > limit;
    const posts = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? skip + limit : null;

    const responseData = { posts, nextCursor, hasMore };

    // Short cache since this is semi-random and should feel fresh
    setCache(cacheKey, responseData, 120);

    return res.status(200).json(apiResponse.success('Discover feed retrieved', responseData));
  } catch (error) {
    console.error('Discover feed error:', error);
    return res.status(500).json(apiResponse.error('Failed to get discover feed'));
  }
};
