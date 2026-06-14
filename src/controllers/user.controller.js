import User from "../models/User.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import Field from "../models/Field.js";
import apiResponse from "../utils/apiResponse.js";
import { uploadImageToCloudinary } from "../middlewares/upload.middleware.js";
import sendPushNotification from "../utils/sendPushNotification.js";
import { getIO } from "../socket/socket.js";
import { logActivity } from "../services/activity.service.js";
import { deleteCacheByPrefix } from "../utils/cache.js";

export const ping = async (req, res) => {
  try {
    const { sessionDuration } = req.body;
    if (sessionDuration >= 900) {
      logActivity(req.user._id, "session");
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error during ping."));
  }
};

export const getMe = async (req, res) => {
  console.log('getMe controller called for user:', req.user?._id);
  try {
    const user = await User.findById(req.user._id)
      .populate("priorityFields", "name slug")
      .populate("emailNotifications", "name slug")
      .select("-password -refreshToken");
    if (!user)
      return res.status(404).json(apiResponse.error("User not found."));
    return res
      .status(200)
      .json(apiResponse.success("Profile retrieved successfully.", { user }));
  } catch (error) {
    console.error('getMe Error:', error);
    return res
      .status(500)
      .json(apiResponse.error("Internal server error getting profile."));
  }
};

export const updateMe = async (req, res) => {
  try {
    const { name, bio } = req.body;
    const user = await User.findById(req.user._id);
    if (!user)
      return res.status(404).json(apiResponse.error("User not found."));

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;

    if (req.file) {
      try {
        const uploadResult = await uploadImageToCloudinary(
          req.file.buffer,
          "sob/avatars",
        );
        user.avatar = uploadResult.secure_url;
      } catch {
        return res
          .status(500)
          .json(apiResponse.error("Failed to upload avatar to cloud storage."));
      }
    }

    await user.save();
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.refreshToken;
    return res.status(200).json(
      apiResponse.success("Profile updated successfully.", {
        user: sanitizedUser,
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error updating profile."));
  }
};

export const deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;

    // FIXED: Full cascade deletion
    // 1. Delete all posts by this user (and their Cloudinary/Mux media)
    const userPosts = await Post.find({ author: userId });
    for (const post of userPosts) {
      if (post.media?.length) {
        for (const item of post.media) {
          if (item.type === 'image' && item.public_id) {
            // Need a Cloudinary instance configured here, or ensure imported module handles it
            // Assuming cloudinary is imported and configured globally or in middleware
            await import('cloudinary').then(c => c.v2.uploader.destroy(item.public_id).catch(() => {}));
          }
          if (item.type === 'video' && item.muxAssetId) {
             // Assuming muxClient is defined or importable
             // await muxClient.video.assets.delete(item.muxAssetId).catch(() => {})
          }
        }
      }
    }
    await Post.deleteMany({ author: userId });

    // 2. Delete all comments by this user
    await Comment.deleteMany({ author: userId });

    // 3. Remove this user's likes/bookmarks from all posts
    await Post.updateMany(
      {},
      { $pull: { likes: userId, bookmarks: userId } }
    );

    // 4. Remove this user's likes from all comments
    await Comment.updateMany(
      {},
      { $pull: { likes: userId } }
    );

    // 5. Remove this user from followers/following lists of others
    await User.updateMany(
      {},
      { $pull: { followers: userId, following: userId } }
    );

    // 6. Delete all notifications where this user is sender or recipient
    await Notification.deleteMany({
      $or: [{ recipient: userId }, { sender: userId }]
    });

    // 7. Delete all activity logs for this user
    await UserActivity.deleteMany({ userId });

    // 8. Delete the user's avatar from Cloudinary if it exists
    const user = await User.findById(userId);
    if (user?.avatar && user.avatar.includes('cloudinary')) {
      const publicId = user.avatar.split('/').pop().split('.')[0];
      await import('cloudinary').then(c => c.v2.uploader.destroy(`sob/avatars/${publicId}`).catch(() => {}));
    }

    // 9. Finally delete the user document itself
    await User.findByIdAndDelete(userId);

    return res.status(200).json(
      apiResponse.success('Account deleted successfully', null)
    )
  } catch (error) {
    console.error('Account deletion error:', error)
    return res.status(500).json(
      apiResponse.error('Failed to delete account')
    )
  }
};

export const getPublicProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      username: req.params.username.toLowerCase(),
    })
      .populate("priorityFields", "name slug")
      .select("-password -refreshToken -email -emailNotifications");
    if (!user)
      return res.status(404).json(apiResponse.error("User profile not found."));

    const postsCount = await Post.countDocuments({
      author: user._id,
      isPublished: true,
    });

    const isFollowing = user.followers.some(
      (followerId) => followerId.toString() === req.user?._id?.toString()
    );

    return res.status(200).json(
      apiResponse.success("Public profile retrieved successfully.", {
        user: {
          ...user.toObject(),
          isFollowing,
        },
        stats: {
          followersCount: user.followers.length,
          followingCount: user.following.length,
          postsCount,
        },
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error getting public profile."));
  }
};

export const toggleFollow = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res
        .status(400)
        .json(apiResponse.error("You cannot follow yourself."));
    }

    const [targetUser, currentUser] = await Promise.all([
      User.findById(targetUserId),
      User.findById(currentUserId),
    ]);
    if (!targetUser)
      return res
        .status(404)
        .json(apiResponse.error("User to follow not found."));

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);

      const notification = new Notification({
        recipient: targetUserId,
        sender: currentUserId,
        type: "follow",
      });
      await notification.save();

      try {
        getIO()
          .to(targetUserId.toString())
          .emit("new_notification", {
            _id: notification._id,
            sender: {
              _id: currentUser._id,
              name: currentUser.name,
              username: currentUser.username,
              avatar: currentUser.avatar,
            },
            type: "follow",
            createdAt: notification.createdAt,
          });

        if (targetUser.pushSubscription?.endpoint) {
          sendPushNotification(targetUser._id, targetUser.pushSubscription, {
            title: "New Follower",
            body: `${currentUser.name} started following you.`,
            url: `${process.env.CLIENT_URL || "http://localhost:3000"}/profile/${currentUser.username}`,
          });
        }
      } catch {}
    }

    await Promise.all([currentUser.save(), targetUser.save()]);
    if (!isFollowing) logActivity(currentUserId, "follow");
    
    // NEW: Invalidate FYF cache after follow/unfollow
    deleteCacheByPrefix(`fyf:${currentUserId}:`);

    return res.status(200).json(
      apiResponse.success(
        isFollowing
          ? `Unfollowed ${targetUser.username}.`
          : `Followed ${targetUser.username}.`,
        {
          isFollowing: !isFollowing,
          followersCount: targetUser.followers.length,
        },
      ),
    );
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error during follow action."));
  }
};

export const getFollowers = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json(apiResponse.error("User not found."));

    const populatedUser = await User.findById(req.params.id).populate({
      path: "followers",
      select: "name username avatar bio",
      options: {
        skip,
        limit: parseInt(limit),
      },
    });

    const followers = populatedUser.followers;
    const currentUser = req.user;

    const followingSet = currentUser
      ? new Set(currentUser.following.map((id) => id.toString()))
      : new Set();

    const followersWithStatus = followers.map((f) => {
      const fObj = f.toObject();
      return {
        ...fObj,
        isFollowing: followingSet.has(f._id.toString()),
      };
    });

    return res.status(200).json(
      apiResponse.success("Followers list retrieved.", {
        followers: followersWithStatus,
        hasMore: user.followers.length > skip + followers.length,
      }),
    );
  } catch (error) {
    console.error("Error in getFollowers:", error);
    return res
      .status(500)
      .json(apiResponse.error("Internal server error getting followers."));
  }
};

export const getFollowing = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).json(apiResponse.error("User not found."));

    const populatedUser = await User.findById(req.params.id).populate({
      path: "following",
      select: "name username avatar bio",
      options: {
        skip,
        limit: parseInt(limit),
      },
    });

    const following = populatedUser.following;
    const currentUser = req.user;

    const followingSet = currentUser
      ? new Set(currentUser.following.map((id) => id.toString()))
      : new Set();

    const followingWithStatus = following.map((f) => {
      const fObj = f.toObject();
      return {
        ...fObj,
        isFollowing: followingSet.has(f._id.toString()),
      };
    });

    return res.status(200).json(
      apiResponse.success("Following list retrieved.", {
        following: followingWithStatus,
        hasMore: user.following.length > skip + following.length,
      }),
    );
  } catch (error) {
    console.error("Error in getFollowing:", error);
    return res
      .status(500)
      .json(apiResponse.error("Internal server error getting following."));
  }
};

export const updateFields = async (req, res) => {
  try {
    const { priorityFields } = req.body;
    if (!Array.isArray(priorityFields) || priorityFields.length !== 5) {
      return res
        .status(400)
        .json(apiResponse.error("You must select exactly 5 priority fields."));
    }
    const count = await Field.countDocuments({ _id: { $in: priorityFields } });
    if (count !== 5)
      return res
        .status(400)
        .json(apiResponse.error("One or more selected fields are invalid."));

    const user = await User.findById(req.user._id);
    user.priorityFields = priorityFields;
    await user.save();
    deleteCacheByPrefix(`fyf:${req.user._id}:`);
    return res.status(200).json(
      apiResponse.success("Priority fields updated successfully.", {
        priorityFields: user.priorityFields,
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        apiResponse.error("Internal server error updating priority fields."),
      );
  }
};

export const updateNotifications = async (req, res) => {
  try {
    const { emailNotifications } = req.body;
    if (!Array.isArray(emailNotifications)) {
      return res
        .status(400)
        .json(apiResponse.error("Email notifications must be an array."));
    }
    const count = await Field.countDocuments({
      _id: { $in: emailNotifications },
    });
    if (count !== emailNotifications.length) {
      return res
        .status(400)
        .json(
          apiResponse.error("One or more notification fields are invalid."),
        );
    }
    const user = await User.findById(req.user._id);
    user.emailNotifications = emailNotifications;
    await user.save();
    return res.status(200).json(
      apiResponse.success("Email notification preferences updated.", {
        emailNotifications: user.emailNotifications,
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        apiResponse.error(
          "Internal server error updating notification settings.",
        ),
      );
  }
};

export const savePushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;

    // Validate based on type
    const isExpo = subscription.tokenType === "expo";
    if (isExpo) {
      if (!subscription.token)
        return res
          .status(400)
          .json(apiResponse.error("Expo token is required."));
    } else {
      if (!subscription.endpoint || !subscription.keys)
        return res
          .status(400)
          .json(
            apiResponse.error("Web subscription is missing endpoint or keys."),
          );
    }

    const user = await User.findById(req.user._id);
    if (!user)
      return res.status(404).json(apiResponse.error("User not found."));

    user.pushSubscription = isExpo
      ? { tokenType: "expo", token: subscription.token }
      : {
          tokenType: "web",
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        };

    await user.save();
    return res
      .status(200)
      .json(apiResponse.success("Push subscription saved successfully."));
  } catch (error) {
    console.error("Save Push Subscription Error:", error.message);
    return res
      .status(500)
      .json(
        apiResponse.error("Internal server error saving push subscription."),
      );
  }
};

export const togglePrivacy = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isPrivate = !user.isPrivate;
    await user.save();
    return res
      .status(200)
      .json(
        apiResponse.success(
          `Account is now ${user.isPrivate ? "private" : "public"}.`,
          { isPrivate: user.isPrivate },
        ),
      );
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error toggling privacy."));
  }
};

export const toggleBlockUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user._id;

    if (targetUserId === currentUserId.toString()) {
      return res
        .status(400)
        .json(apiResponse.error("You cannot block yourself."));
    }

    const user = await User.findById(currentUserId);
    const isBlocked = user.blockedUsers.includes(targetUserId);

    if (isBlocked) {
      user.blockedUsers.pull(targetUserId);
    } else {
      user.blockedUsers.push(targetUserId);
      // Automatically unfollow each other if they were
      user.following.pull(targetUserId);
      user.followers.pull(targetUserId);
      await User.findByIdAndUpdate(targetUserId, {
        $pull: { followers: currentUserId, following: currentUserId },
      });
    }

    await user.save();
    return res.status(200).json(
      apiResponse.success(isBlocked ? "User unblocked." : "User blocked.", {
        isBlocked: !isBlocked,
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error toggling block."));
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "blockedUsers",
      "name username avatar",
    );
    return res.status(200).json(
      apiResponse.success("Blocked users list retrieved.", {
        blockedUsers: user.blockedUsers,
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(apiResponse.error("Internal server error getting blocked users."));
  }
};
