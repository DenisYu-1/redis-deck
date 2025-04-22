# Backend Functional Tests

This directory contains comprehensive functional tests for the Redis UI backend application. All tests use real Redis connections to ensure full integration testing.

## Test Structure

```
__tests__/
├── setup.js                    # Global test setup and teardown
├── helpers/
│   └── testHelpers.js         # Utility functions for test data management
├── services/
│   ├── database.test.js       # Database service tests
│   └── redis.test.js          # Redis service tests
└── routes/
    ├── connections.test.js    # Connection management API tests
    ├── keys.test.js           # Key operations API tests
    ├── info.test.js           # Redis info and admin API tests
    ├── environment.test.js    # Environment API tests
    └── custom.test.js         # Custom command execution API tests
```

## Running Tests

### Prerequisites

1. Redis server must be running and accessible
2. Install dependencies:
```bash
yarn install
```

### Environment Variables

Configure test Redis connection via environment variables (optional):

```bash
REDIS_TEST_HOST=127.0.0.1
REDIS_TEST_PORT=6379
REDIS_TEST_USER=
REDIS_TEST_PASSWORD=
REDIS_TEST_TLS=false
REDIS_TEST_CLUSTER=false
```

Default values connect to local Redis on port 6379.

### Run All Tests

```bash
yarn test
```

### Run Specific Test Suite

```bash
yarn test database.test.js
yarn test redis.test.js
yarn test connections.test.js
```

### Run Tests in Watch Mode

```bash
yarn test:watch
```

### Run Tests with Coverage

```bash
yarn test --coverage
```

## Test Features

### Functional Testing
- All tests use real Redis connections
- Tests perform actual database operations
- Full integration testing of API endpoints

### Test Isolation
- Each test uses unique key prefixes
- Automatic cleanup of test data after each test
- Test connection managed in global setup

### Comprehensive Coverage

#### Database Service Tests
- CRUD operations for connections
- Connection ordering
- Configuration management

#### Redis Service Tests
- Command execution with real Redis
- Key operations (SET, GET, DEL, etc.)
- Hash operations
- Sorted set operations
- TTL and expiry management
- Cluster-aware operations
- SCAN operations with pagination
- INFO parsing

#### Route Tests
- All HTTP endpoints tested
- Request validation
- Response format verification
- Error handling
- Real Redis data operations

## Test Data Management

Test data uses the `test:*` key prefix pattern for easy identification and cleanup.

### Helper Functions

The `testHelpers.js` module provides utilities for:
- Creating test keys with various data types
- Managing test data lifecycle
- Checking key existence
- Reading key values
- Managing TTLs

## Best Practices

1. **Test Isolation**: Each test cleans up after itself
2. **Real Connections**: Tests connect to actual Redis instances
3. **Descriptive Names**: Test names clearly describe what they verify
4. **Comprehensive Assertions**: Multiple assertions verify complete behavior
5. **Error Handling**: Tests verify both success and error cases

## Troubleshooting

### Connection Errors

If tests fail with connection errors:
1. Verify Redis is running: `redis-cli ping`
2. Check Redis host/port configuration
3. Ensure Redis accepts connections from test environment

### Test Cleanup

If tests leave data behind:
```bash
redis-cli --scan --pattern "test:*" | xargs redis-cli del
```

### Test Timeout

If tests timeout, increase Jest timeout in `jest.config.js`:
```javascript
testTimeout: 30000  // 30 seconds
```

## Contributing

When adding new tests:
1. Follow existing test structure
2. Use test helper functions for data management
3. Clean up test data in afterEach hooks
4. Use descriptive test names
5. Test both success and error cases
6. Ensure tests work with real Redis connections

