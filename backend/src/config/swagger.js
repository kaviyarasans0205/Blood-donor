export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Blood Donor Management & Emergency Response API',
    version: '1.0.0',
    description:
      'REST API for blood donor management, inventory tracking, emergency blood requests, compatibility matching, appointments, rewards and demand prediction. All endpoints except /api/auth/* and /health require a Bearer JWT.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api', description: 'Current host' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errorCode: { type: 'string', example: 'VALIDATION_ERROR' },
          details: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } } } },
        },
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
          meta: { type: 'object' },
        },
      },
      BloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] },
      Priority: { type: 'string', enum: ['CRITICAL', 'URGENT', 'NORMAL'] },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a donor, requester or admin account',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password', 'phone'], properties: {
            name: { type: 'string' }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 8 },
            phone: { type: 'string' }, role: { type: 'string', enum: ['donor', 'requester', 'admin'], default: 'donor' },
            bloodGroup: { $ref: '#/components/schemas/BloodGroup' }, dateOfBirth: { type: 'string', format: 'date' },
            gender: { type: 'string', enum: ['male', 'female', 'other'] }, address: { type: 'string' }, city: { type: 'string' },
            state: { type: 'string' }, pincode: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' },
            weight: { type: 'number' }, organizationName: { type: 'string' },
          } } } },
        },
        responses: { 201: { description: 'Account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }, 409: { $ref: '#/components/schemas/Error' }, 422: { $ref: '#/components/schemas/Error' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Login with email and password', security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } },
        responses: { 200: { description: 'JWT + user' }, 401: { $ref: '#/components/schemas/Error' } },
      },
    },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current user + profile', responses: { 200: { description: 'OK' }, 401: { $ref: '#/components/schemas/Error' } } } },
    '/donors': {
      get: { tags: ['Donors'], summary: 'List donors (admin/requester)', parameters: [{ in: 'query', name: 'bloodGroup', schema: { $ref: '#/components/schemas/BloodGroup' } }, { in: 'query', name: 'search', schema: { type: 'string' } }, { in: 'query', name: 'page', schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 403: { $ref: '#/components/schemas/Error' } } },
    },
    '/donors/eligible': { get: { tags: ['Donors'], summary: 'Eligible donors, optional radius filter', parameters: [{ in: 'query', name: 'bloodGroup', schema: { $ref: '#/components/schemas/BloodGroup' } }, { in: 'query', name: 'latitude', schema: { type: 'number' } }, { in: 'query', name: 'longitude', schema: { type: 'number' } }, { in: 'query', name: 'radiusKm', schema: { type: 'number' } }], responses: { 200: { description: 'OK' } } } },
    '/donors/compatible/{bloodGroup}': {
      get: { tags: ['Donors'], summary: 'Ranked compatible + eligible donors for a blood group', parameters: [{ in: 'path', name: 'bloodGroup', required: true, schema: { $ref: '#/components/schemas/BloodGroup' } }, { in: 'query', name: 'latitude', schema: { type: 'number' } }, { in: 'query', name: 'longitude', schema: { type: 'number' } }, { in: 'query', name: 'radiusKm', schema: { type: 'number', default: 50 } }], responses: { 200: { description: 'Ranked list with distanceKm, eligible, score' } } },
    },
    '/donors/nearby': { get: { tags: ['Donors'], summary: 'Nearby donors by Haversine distance', parameters: [{ in: 'query', name: 'latitude', required: true, schema: { type: 'number' } }, { in: 'query', name: 'longitude', required: true, schema: { type: 'number' } }, { in: 'query', name: 'radiusKm', schema: { type: 'number' } }, { in: 'query', name: 'bloodGroup', schema: { $ref: '#/components/schemas/BloodGroup' } }], responses: { 200: { description: 'OK' } } } },
    '/eligibility/check': { post: { tags: ['Eligibility'], summary: 'Run rule-based eligibility screening', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { age: { type: 'number' }, weightKg: { type: 'number' }, answers: { type: 'object' }, saveToProfile: { type: 'boolean' } } } } } }, responses: { 201: { description: 'ELIGIBLE or NOT_ELIGIBLE with reasons' } } } },
    '/eligibility/rules': { get: { tags: ['Eligibility'], summary: 'Current configurable rules', responses: { 200: { description: 'OK' } } } },
    '/inventory': {
      get: { tags: ['Inventory'], summary: 'List stock batches + summary', parameters: [{ in: 'query', name: 'bloodGroup', schema: { $ref: '#/components/schemas/BloodGroup' } }, { in: 'query', name: 'status', schema: { type: 'string' } }, { in: 'query', name: 'expiringWithinDays', schema: { type: 'integer' } }], responses: { 200: { description: 'OK' } } },
      post: { tags: ['Inventory'], summary: 'Add blood stock batch (admin)', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['bloodGroup', 'units', 'batchNumber', 'collectionDate', 'expiryDate', 'location'], properties: { bloodGroup: { $ref: '#/components/schemas/BloodGroup' }, units: { type: 'integer' }, batchNumber: { type: 'string' }, collectionDate: { type: 'string', format: 'date' }, expiryDate: { type: 'string', format: 'date' }, location: { type: 'string' } } } } } }, responses: { 201: { description: 'Created' } } },
    },
    '/inventory/alerts': { get: { tags: ['Inventory'], summary: 'Low-stock + expiry alerts', responses: { 200: { description: 'OK' } } } },
    '/inventory/expiring': { get: { tags: ['Inventory'], summary: 'Batches expiring within N days', parameters: [{ in: 'query', name: 'days', schema: { type: 'integer', default: 7 } }], responses: { 200: { description: 'OK' } } } },
    '/emergency-requests': {
      post: { tags: ['Emergency'], summary: 'Create emergency blood request (auto priority classification)', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['patientName', 'hospital', 'contactNumber', 'bloodGroup', 'requiredUnits', 'latitude', 'longitude', 'requiredAt'], properties: { patientName: { type: 'string' }, hospital: { type: 'string' }, contactNumber: { type: 'string' }, bloodGroup: { $ref: '#/components/schemas/BloodGroup' }, requiredUnits: { type: 'integer' }, latitude: { type: 'number' }, longitude: { type: 'number' }, requiredAt: { type: 'string', format: 'date-time' }, emergencyLevel: { type: 'string', enum: ['critical', 'urgent', 'normal'] }, notes: { type: 'string' } } } } } }, responses: { 201: { description: 'Created with priority + classification reasons' } } },
      get: { tags: ['Emergency'], summary: 'List requests (requester sees own)', responses: { 200: { description: 'OK' } } },
    },
    '/emergency-requests/priority-queue': { get: { tags: ['Emergency'], summary: 'CRITICAL > URGENT > NORMAL, then earliest first', responses: { 200: { description: 'Sorted queue with queuePosition' } } } },
    '/emergency-requests/{id}/match': { post: { tags: ['Emergency'], summary: 'Run donor matching (compatibility + eligibility + Haversine distance)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }, { in: 'query', name: 'notify', schema: { type: 'string', enum: ['true', 'false'] } }], responses: { 200: { description: 'Ranked matches' } } } },
    '/emergency-requests/{id}/fulfill': { post: { tags: ['Emergency'], summary: 'Allocate inventory to request (admin)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/appointments': {
      post: { tags: ['Appointments'], summary: 'Book donation appointment (conflict-checked)', responses: { 201: { description: 'Created' }, 409: { $ref: '#/components/schemas/Error' } } },
      get: { tags: ['Appointments'], summary: 'List appointments', responses: { 200: { description: 'OK' } } },
    },
    '/notifications': { get: { tags: ['Notifications'], summary: 'Current user notifications', responses: { 200: { description: 'OK' } } } },
    '/rewards': { get: { tags: ['Rewards'], summary: 'Points + history', responses: { 200: { description: 'OK' } } } },
    '/prediction/demand': { post: { tags: ['Prediction'], summary: 'Get/refresh 14-day demand forecasts (cached)', responses: { 200: { description: 'Predictions with risk level + recommendation' } } } },
    '/prediction/predict-demand': { post: { tags: ['Prediction'], summary: 'One-off forecast for a series', requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { bloodGroup: { $ref: '#/components/schemas/BloodGroup' }, historicalData: { type: 'array', items: { type: 'number' } }, forecastPeriod: { type: 'integer' } } } } } }, responses: { 200: { description: 'OK' } } } },
    '/admin/dashboard': { get: { tags: ['Admin'], summary: 'All dashboard cards + charts', responses: { 200: { description: 'OK' }, 403: { $ref: '#/components/schemas/Error' } } } },
    '/admin/analytics': { get: { tags: ['Admin'], summary: 'Long-range analytics', responses: { 200: { description: 'OK' } } } },
    '/admin/donor-map': { get: { tags: ['Admin'], summary: 'Donor locations (masked, privacy-safe)', responses: { 200: { description: 'OK' } } } },
    '/admin/reports': { get: { tags: ['Admin'], summary: 'Generate report (JSON or CSV)', parameters: [{ in: 'query', name: 'type', required: true, schema: { type: 'string', enum: ['donors', 'blood_stock', 'emergency_requests', 'donations', 'expiry', 'appointments', 'demand_prediction', 'rewards'] } }, { in: 'query', name: 'format', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' } }], responses: { 200: { description: 'Report data or CSV file' } } } },
    '/admin/reengagement': { get: { tags: ['Admin'], summary: 'Inactive donor re-engagement list', responses: { 200: { description: 'OK' } } } },
  },
};

export default openApiSpec;
