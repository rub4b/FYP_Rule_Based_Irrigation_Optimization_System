const mongoose = require('mongoose');

const RecommendationSchema = new mongoose.Schema({
  plot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plot',
    required: true,
    index: true
  },
  farmer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recommendation_type: {
    type: String,
    enum: ['irrigate', 'skip', 'reduce', 'maintain'],
    required: true
  },
  recommendation_text: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'overridden'],
    default: 'pending',
    index: true
  },
  farmer_action: {
    type: String,
    enum: ['accepted', 'rejected', 'override_irrigate', 'override_skip', null],
    default: null
  },
  farmer_notes: {
    type: String,
    default: ''
  },
  // Context at time of recommendation
  moisture_level: {
    type: Number,
    required: true
  },
  weather_condition: {
    temperature: Number,
    humidity: Number,
    precipitation_probability: Number
  },
  estimated_water_ml: {
    type: Number,
    default: 0
  },
  actual_water_ml: {
    type: Number,
    default: null
  },
  responded_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for performance
RecommendationSchema.index({ farmer_id: 1, createdAt: -1 });
RecommendationSchema.index({ plot_id: 1, status: 1 });
RecommendationSchema.index({ createdAt: -1 });

// Virtual for calculating water volume saved
RecommendationSchema.virtual('waterVolumeSaved').get(function() {
  if (this.farmer_action === 'accepted' && this.estimated_water_ml && this.actual_water_ml) {
    return this.estimated_water_ml - this.actual_water_ml;
  }
  return 0;
});

// Virtual for calculating cost saved (operational cost from avoided irrigation)
RecommendationSchema.virtual('costSaved').get(function() {
  const COST_PER_HOUR_SAVED = 20; // RM (fuel + electricity + labor)
  if (this.farmer_action === 'accepted') {
    return COST_PER_HOUR_SAVED;
  }
  return 0;
});

module.exports = mongoose.model('Recommendation', RecommendationSchema);
