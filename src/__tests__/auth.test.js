const authMiddleware = require('../middleware/auth');

describe('Auth Middleware', () => {
  it('binds the default test API key to org_demo', () => {
    const req = {
      headers: {
        authorization: 'Bearer sk_test_123456789',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.organizationId).toBe('org_demo');
  });

  it('rejects organization spoofing through headers', () => {
    const req = {
      headers: {
        authorization: 'Bearer sk_test_123456789',
        'x-organization-id': 'org_spoofed',
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'organization_mismatch',
        message: 'API key does not have access to the requested organization'
      }
    });
  });
});
