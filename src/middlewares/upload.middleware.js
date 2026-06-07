import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import mux from '../config/mux.js';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only images and videos are allowed.'), false);
    }
  },
});

export const uploadImageToCloudinary = (fileBuffer, folder = 'sob') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(fileBuffer);
  });

export const uploadVideoToMux = async (fileBuffer) => {
  try {
    const upload = await mux.video.uploads.create({
      new_asset_settings: { playback_policy: ['public'] },
    });

    await fetch(upload.url, {
      method: 'PUT',
      body: fileBuffer,
      headers: { 'Content-Type': 'application/octet-stream' },
    });

    // Polling for asset_id
    let assetId;
    for (let i = 0; i < 30; i++) {
      const uploadStatus = await mux.video.uploads.retrieve(upload.id);
      if (uploadStatus.status === 'asset_created') {
        assetId = uploadStatus.asset_id;
        break;
      } else if (uploadStatus.status === 'errored') {
        throw new Error('Mux upload failed');
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!assetId) throw new Error('Mux asset creation timed out');

    const asset = await mux.video.assets.retrieve(assetId);
    return {
      secure_url: `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`,
      playbackId: asset.playback_ids[0].id,
      assetId: asset.id,
      thumbnail: `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`
    };
  } catch (error) {
    console.error('Mux Upload Error:', error.message);
    throw error;
  }
};
