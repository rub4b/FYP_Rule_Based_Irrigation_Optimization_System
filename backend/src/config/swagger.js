const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { BASE_URL } = require('./env');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aquametic Smart Irrigation API',
      version: '1.0.0',
      description: 'IoT-based smart irrigation system API for real-time moisture monitoring and operational cost savings analytics',
      contact: {
        name: 'Aquametic Team',
        email: 'nerdyrumble29@gmail.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: BASE_URL,
        description: 'API Server'
      },
      {
        url: 'https://api.aquametic.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from login endpoint'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['username', 'name', 'email', 'password'],
          properties: {
            _id: { type: 'string', description: 'User ID' },
            username: { type: 'string', description: 'Unique username' },
            name: { type: 'string', description: 'Full name' },
            email: { type: 'string', format: 'email', description: 'Email address' },
            phone: { type: 'string', description: 'Phone number' },
            role: { type: 'string', enum: ['farmer', 'admin'], default: 'farmer' },
            farm_name: { type: 'string', description: 'Farm name' },
            location: { type: 'string', description: 'Farm location' },
            farm_size: { type: 'string', description: 'Farm size' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Plot: {
          type: 'object',
          required: ['name', 'sensor_id', 'location'],
          properties: {
            _id: { type: 'string', description: 'Plot ID' },
            name: { type: 'string', description: 'Plot name' },
            farmer_id: { type: 'string', description: 'Owner user ID' },
            sensor_id: { type: 'string', description: 'Associated sensor ID' },
            location: { type: 'string', description: 'Plot location' },
            current_moisture: { type: 'number', description: 'Current moisture %', default: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        SensorData: {
          type: 'object',
          required: ['sensor_id', 'moisture_value'],
          properties: {
            _id: { type: 'string', description: 'Reading ID' },
            sensor_id: { type: 'string', description: 'Sensor ID' },
            moisture_value: { type: 'number', description: 'Moisture percentage', minimum: 0, maximum: 100 },
            timestamp: { type: 'string', format: 'date-time' },
            sync_metadata: {
              type: 'object',
              properties: {
                is_offline_sync: { type: 'boolean', default: false }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', description: 'Error message' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.js'], // Path to the API routes files
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };
