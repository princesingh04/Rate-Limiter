import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    targetUrl: {
      type: String,
      required: true,
      trim: true,
    },
    // The Project ID itself acts as the routing parameter/API key.
    // e.g. /proxy/<PROJECT_ID>/users -> forwards to targetUrl/users
    rateLimitConfig: {
      algorithm: {
        type: String,
        enum: ['token-bucket', 'sliding-window-log'],
        default: 'token-bucket',
      },
      // Used by Token Bucket
      capacity: {
        type: Number,
        default: 10,
      },
      refillRate: {
        type: Number,
        default: 1, // tokens per second
      },
      // Used by Sliding Window
      windowMs: {
        type: Number,
        default: 60000,
      },
      maxRequests: {
        type: Number,
        default: 10,
      },
    },
  },
  { timestamps: true }
);

export const Project = mongoose.model('Project', projectSchema);
