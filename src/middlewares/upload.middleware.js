import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import mux from '../config/mux.js';

// IMPROVED: Strict media validation and optimized Cloudinary transformations
const storage = multer.memoryStorage();

const MIME_TYPES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'video/mp4': [0x66, 0x74, 0x79, 0x70],
  'video/webm': [0x1A, 0x45, 0xDF, 0xA3],
  'video/quicktime': [0x66, 0x74, 0x79, 0x70] // .mov
};

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // IMPROVED: Capped at 15MB (Mux requirement)
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');

    if (isImage || isVideo) {
      if (isImage && file.size > 5 * 1024 * 1024) {
        return cb(new Error('Image size exceeds 5MB limit.'), false);
      }
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only images (jpeg, png, webp) and videos (mp4, webm, mov) are allowed.'), false);
    }
  },
});

// IMPROVED: Helper for magic bytes validation
export const validateFileHeader = (buffer, mimetype) => {
  const signature = MIME_TYPES[mimetype];
  if (!signature) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  return true;
};

export const uploadImageToCloudinary = (fileBuffer, folder = 'sob') =>
  new Promise((resolve, reject) => {
    // IMPROVED: Aggressive compression and strip EXIF
    const stream = cloudinary.uploader.upload_stream(
      { 
        folder, 
        resource_type: 'image',
        width: 1080,
        crop: 'limit',
        quality: 'auto:low',
        fetch_format: 'auto',
        flags: 'strip_profile'
      },
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
