/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *  Mongoose schema: RequestLog
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 *  Each document represents a single proxied request
 *  (whether it was allowed through or blocked).
 */
import mongoose from 'mongoose';

const requestLogSchema = new mongoose.Schema(
  {
    /** The project this request belongs to (derived from the URL /proxy/:projectId/...) */
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },

    /** When the request arrived at the gateway */
    timestamp: {
      type: Date,
      default: Date.now,
      index: true, // Indexed for time-range aggregation queries
    },

    /** Client identifier (IPv4 or IPv6) */
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },

    /** The original route the client requested, e.g. "/proxy/get" */
    targetRoute: {
      type: String,
      required: true,
    },

    /** Outcome of the rate-limit check */
    status: {
      type: String,
      enum: ['Passed', 'Blocked'],
      required: true,
      index: true,
    },

    /** Time in ms from request arrival to response (or rejection) */
    responseTime: {
      type: Number,
      default: 0,
    },

    /** Which algorithm processed this request */
    algorithm: {
      type: String,
      enum: ['token-bucket', 'sliding-window-log'],
      default: 'token-bucket',
    },
  },
  {
    // Disable __v since we never update documents after insertion.
    versionKey: false,
  }
);

/**
 * Compound index for the analytics summary aggregation pipeline.
 * Queries typically filter by timestamp range AND group by status.
 */
requestLogSchema.index({ timestamp: 1, status: 1 });

export const RequestLog = mongoose.model('RequestLog', requestLogSchema);
