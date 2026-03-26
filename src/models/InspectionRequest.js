import mongoose from 'mongoose';

const inspectionRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    requestNumber: {
      type: String,
      unique: true,
      index: true,
    },

    serviceType: {
      type: String,
      enum: ['PDI', 'UCI', 'VSH'],
      required: true,
    },

    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true },
    },

    vehicleSnapshot: {
      brand: { type: String, default: '' },
      model: { type: String, required: true },
      year: { type: Number, default: null },
      vin: { type: String, default: '' },
      registrationNumber: { type: String, default: '' },
      price: { type: Number, default: null },
    },

    schedule: {
      date: { type: Date, default: null },
      slot: { type: String, default: '' },
    },

    location: {
      address: { type: String, default: '' },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },

    vshFile: {
      url: { type: String, default: null },
      originalName: { type: String, default: null },
      mimeType: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },

    adminJobId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'FORWARDED',
        'CANCELLATION_REQUESTED', 'CANCELLED',
        'RESCHEDULE_REQUESTED', 'RESCHEDULED',
        'ASSIGNMENT_FAILED', 'REFUNDED', 'FAILED', 'EXPERT_ASSIGNED',
      ],
      default: 'PENDING_PAYMENT',
    },

    payment: {
      status: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'REFUNDED'],
        default: 'NOT_REQUIRED',
      },
      amount: Number,
      currency: { type: String, default: 'INR' },
      razorpayOrderId: String,
      razorpayPaymentId: String,
      paidAt: Date,
      provider: String,
      providerPaymentId: String,
      type: { type: String, enum: ['FULL', 'PARTIAL'], default: 'FULL' },
      paidAmount: { type: Number, default: 0 },
      remainingAmount: { type: Number, default: 0 },
      razorpayPaymentLinkId: { type: String, default: null },
      razorpayPaymentLinkUrl: { type: String, default: null },
      remainingRazorpayPaymentId: { type: String, default: null },
      remainingPaidAt: { type: Date, default: null },
    },

    appliedCoupon: {
      code: { type: String, default: null },
      discountType: { type: String, default: null },
      discountValue: { type: Number, default: null },
      discount: { type: Number, default: null },
      originalAmount: { type: Number, default: null },
      finalAmount: { type: Number, default: null },
    },

    addOnVSH: { type: Boolean, default: false },
    addOnVSHPrice: { type: Number, default: 0 },

    customerNotes: {
      type: String,
      default: '',
    },

    cancellation: {
      reason: { type: String, default: '' },
      requestedAt: { type: Date, default: null },
      confirmedAt: { type: Date, default: null },
    },

    reschedule: {
      reason: { type: String, default: '' },
      originalSchedule: {
        date: { type: Date, default: null },
        slot: { type: String, default: '' },
      },
      requestedSchedule: {
        date: { type: Date, default: null },
        slot: { type: String, default: '' },
      },
      requestedAt: { type: Date, default: null },
      confirmedAt: { type: Date, default: null },
    },

    assignmentFailure: {
      reason: { type: String, default: '' },
      failedAt: { type: Date, default: null },
    },

    refund: {
      razorpayRefundId: { type: String, default: '' },
      amount: { type: Number, default: null },
      cancellationFee: { type: Number, default: 0 },
      cancellationFeePercent: { type: Number, default: 0 },
      isLateCancellation: { type: Boolean, default: false },
      processedAt: { type: Date, default: null },
    },

    statusHistory: [{
      from: { type: String },
      to: { type: String },
      changedAt: { type: Date, default: Date.now },
      changedBy: { type: String, enum: ['CUSTOMER', 'ADMIN', 'SYSTEM'], default: 'SYSTEM' },
      note: { type: String, default: '' },
    }],
  },
  { timestamps: true }
);

inspectionRequestSchema.pre('save', async function preSave(next) {
  if (this.requestNumber) return next();

  const last = await mongoose.model('InspectionRequest')
    .findOne({}, { requestNumber: 1 })
    .sort({ requestNumber: -1 })
    .lean();

  let nextNum = 1;
  if (last?.requestNumber) {
    const match = last.requestNumber.match(/^REQ-(\d+)$/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }

  this.requestNumber = `REQ-${String(nextNum).padStart(6, '0')}`;
  return next();
});

const InspectionRequest = mongoose.model('InspectionRequest', inspectionRequestSchema);

export default InspectionRequest;
