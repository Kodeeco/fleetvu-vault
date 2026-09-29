import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const BASE_URL = 'https://api.fleetvu.com/v1';

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'FleetVu Enterprise API Gateway',
    description:
      'RESTful API for telemetry ingestion, asset management, and FleetVu Vault notarization. ' +
      'All endpoints require OAuth 2.0 Bearer token authentication (Auth0 / AWS Cognito JWT). ' +
      'Designed for third-party camera and telematics integration partners.',
    version: '1.0.0',
    contact: {
      name: 'FleetVu API Support',
      email: 'api-support@fleetvu.com',
    },
    license: {
      name: 'Enterprise License',
      url: 'https://fleetvu.com/api-license',
    },
  },
  servers: [
    { url: BASE_URL, description: 'Production API Gateway' },
    { url: 'https://staging-api.fleetvu.com/v1', description: 'Staging / Integration Testing' },
  ],
  tags: [
    { name: 'Telemetry', description: 'High-frequency sensor telemetry ingestion and time-windowed queries' },
    { name: 'Assets', description: 'Vehicle, driver, and fleet asset management' },
    { name: 'Vault', description: 'FleetVu Vault cryptographic notarization and audit trail' },
    { name: 'Auth', description: 'OAuth 2.0 / OIDC authentication' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'OAuth 2.0 / OIDC Bearer token (Auth0 or AWS Cognito JWT). ' +
          'Obtain from /auth/token using client credentials or authorization code flow.',
      },
      oauth2: {
        type: 'oauth2',
        flows: {
          clientCredentials: {
            tokenUrl: '/auth/token',
            scopes: {
              'telemetry:write': 'Write telemetry data',
              'telemetry:read': 'Read telemetry data',
              'assets:read': 'Read fleet asset data',
              'assets:write': 'Manage fleet assets',
              'vault:notarize': 'Submit documents for cryptographic notarization',
              'vault:read': 'Read notarized audit trail',
            },
          },
          authorizationCode: {
            authorizationUrl: '/auth/authorize',
            tokenUrl: '/auth/token',
            scopes: {
              'telemetry:write': 'Write telemetry data',
              'telemetry:read': 'Read telemetry data',
              'assets:read': 'Read fleet asset data',
              'assets:write': 'Manage fleet assets',
              'vault:notarize': 'Submit documents for cryptographic notarization',
              'vault:read': 'Read notarized audit trail',
            },
          },
        },
      },
    },
    schemas: {
      TelemetryEvent: {
        type: 'object',
        required: ['vehicle_id', 'utc_timestamp', 'sensor_type'],
        properties: {
          vehicle_id: { type: 'string', format: 'uuid', description: 'Vehicle identifier' },
          driver_id: { type: 'string', format: 'uuid', description: 'Driver identifier' },
          company_id: { type: 'string', format: 'uuid', description: 'Company identifier' },
          sensor_type: {
            type: 'string',
            enum: ['c55_radar', 'ultrasonic', 'speed', 'gps', 'g_force', 'proximity'],
            description: 'Type of sensor reading',
          },
          speed_mph: { type: 'number', format: 'float', minimum: 0, maximum: 200 },
          distance_m: { type: 'number', format: 'float', minimum: 0, description: 'Distance reading in meters' },
          proximity_zone: { type: 'string', enum: ['green', 'yellow', 'red', 'null'] },
          latitude: { type: 'number', format: 'double', minimum: -90, maximum: 90 },
          longitude: { type: 'number', format: 'double', minimum: -180, maximum: 180 },
          g_force: { type: 'number', format: 'float' },
          utc_timestamp: { type: 'string', format: 'date-time', description: 'ISO 8601 UTC timestamp' },
          truck_number: { type: 'string', description: 'Vehicle fleet number' },
          driver_name: { type: 'string' },
        },
      },
      TelemetryBatch: {
        type: 'object',
        required: ['events'],
        properties: {
          events: {
            type: 'array',
            items: { $ref: '#/components/schemas/TelemetryEvent' },
            maxItems: 1000,
            description: 'Batch of telemetry events (max 1000 per request)',
          },
        },
      },
      TelemetryQuery: {
        type: 'object',
        properties: {
          vehicle_id: { type: 'string', format: 'uuid' },
          start_time: { type: 'string', format: 'date-time' },
          end_time: { type: 'string', format: 'date-time' },
          sensor_type: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 5000, default: 500 },
        },
      },
      Vehicle: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          truck_number: { type: 'string' },
          company_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['active', 'maintenance', 'retired'] },
          sensor_pair_id: { type: 'string', description: 'C55-PRO sensor pair identifier' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      VaultNotarization: {
        type: 'object',
        required: ['document_hash', 'vehicle_id'],
        properties: {
          document_hash: { type: 'string', description: 'SHA-256 hash of the document to notarize' },
          vehicle_id: { type: 'string', format: 'uuid' },
          incident_id: { type: 'string', format: 'uuid' },
          metadata: { type: 'object', description: 'Additional metadata (GPS, speed, sensor state)' },
          utc_timestamp: { type: 'string', format: 'date-time' },
        },
      },
      VaultNotarizationResponse: {
        type: 'object',
        properties: {
          notarization_id: { type: 'string', format: 'uuid' },
          document_hash: { type: 'string' },
          signature: { type: 'string', description: 'Cryptographic signature (RSA-2048)' },
          block_hash: { type: 'string', description: 'SHA-256 block hash in the audit chain' },
          previous_block_hash: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/telemetry/ingest': {
      post: {
        tags: ['Telemetry'],
        summary: 'Ingest a batch of telemetry events',
        description:
          'Accepts a batch of high-frequency sensor events (C55 77GHz radar, ultrasonic, speed, GPS). ' +
          'Events are stored with microsecond-precision timestamps and indexed for time-series queries.',
        security: [{ bearerAuth: [], oauth2: ['telemetry:write'] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TelemetryBatch' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Telemetry events ingested successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ingested: { type: 'integer', description: 'Number of events ingested' },
                    rejected: { type: 'integer', description: 'Number of events rejected' },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid request body', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          '401': { description: 'Unauthorized — invalid or missing Bearer token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/telemetry/query': {
      post: {
        tags: ['Telemetry'],
        summary: 'Query telemetry events within a time window',
        description:
          'Returns time-windowed telemetry for a vehicle, ordered by timestamp descending. ' +
          'Uses composite index on (vehicle_id, utc_timestamp) for O(log n) lookups.',
        security: [{ bearerAuth: [], oauth2: ['telemetry:read'] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TelemetryQuery' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Telemetry events within the requested time window',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    events: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TelemetryEvent' },
                    },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/assets/vehicles': {
      get: {
        tags: ['Assets'],
        summary: 'List fleet vehicles',
        security: [{ bearerAuth: [], oauth2: ['assets:read'] }],
        parameters: [
          { name: 'company_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'maintenance', 'retired'] } },
        ],
        responses: {
          '200': {
            description: 'List of vehicles',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Vehicle' } } } },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/assets/vehicles/{id}': {
      get: {
        tags: ['Assets'],
        summary: 'Get vehicle by ID',
        security: [{ bearerAuth: [], oauth2: ['assets:read'] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Vehicle details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Vehicle' } } } },
          '404': { description: 'Vehicle not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/vault/notarize': {
      post: {
        tags: ['Vault'],
        summary: 'Submit a document for cryptographic notarization',
        description:
          'Notarizes a document hash into the FleetVu Vault audit chain. ' +
          'Returns a cryptographic signature and block hash linking to the previous entry.',
        security: [{ bearerAuth: [], oauth2: ['vault:notarize'] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/VaultNotarization' } } },
        },
        responses: {
          '201': {
            description: 'Document notarized successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/VaultNotarizationResponse' } } },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/vault/audit/{vehicle_id}': {
      get: {
        tags: ['Vault'],
        summary: 'Retrieve notarized audit trail for a vehicle',
        security: [{ bearerAuth: [], oauth2: ['vault:read'] }],
        parameters: [
          { name: 'vehicle_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'start_time', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'end_time', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          '200': {
            description: 'Audit trail entries',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: { type: 'array', items: { $ref: '#/components/schemas/VaultNotarizationResponse' } },
                    count: { type: 'integer' },
                  },
                },
              },
            },
          },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/auth/token': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange client credentials for a Bearer token',
        description: 'OAuth 2.0 client credentials flow. Supports Auth0 and AWS Cognito JWT issuance.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  grant_type: { type: 'string', enum: ['client_credentials', 'authorization_code'] },
                  client_id: { type: 'string' },
                  client_secret: { type: 'string' },
                  scope: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Access token',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    token_type: { type: 'string', enum: ['Bearer'] },
                    expires_in: { type: 'integer' },
                    scope: { type: 'string' },
                  },
                },
              },
            },
          },
          '401': { description: 'Invalid client credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
