const config = require('./config');

// Parse Authorization header
function parseAuthHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }

  try {
    // Extract Base64 encoded credentials
    const base64Credentials = authHeader.split(' ')[1];
    // Decode credentials
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    // Split username and password
    const [username, password] = credentials.split(':');
    
    return { username, password };
  } catch (error) {
    console.error('Error parsing auth header:', error);
    return null;
  }
}

// Validate user credentials
function validateUser(username, password) {
  // If userRules is not configured, authentication is disabled
  if (!config.userRules || config.userRules.length === 0) {
    return { isAuthenticated: true, permissions: 'rw' };
  }

  // Look for matching user in userRules
  for (const rule of config.userRules) {
    const [ruleUsername, rulePassword, permissions] = rule.split('|');
    
    if (username === ruleUsername && password === rulePassword) {
      return { 
        isAuthenticated: true, 
        permissions,
        username
      };
    }
  }

  return { isAuthenticated: false };
}

// Authentication middleware
function authMiddleware(req, res, next) {
  // If userRules is not configured, authentication is disabled
  if (!config.userRules || config.userRules.length === 0) {
    req.user = { isAuthenticated: true, permissions: 'rw' };
    return next();
  }

  const token = req.query.token;

  if (token) {
    const credentials = Buffer.from(token, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');

    const userStatus = validateUser(username, password);
    if (userStatus.isAuthenticated) {
      req.user = userStatus;
      return next();
    }
    return res.status(401).json({ error: 'Invalid credentials' });

  } else {
    // Get Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // No credentials provided, return 401 and request authentication
      res.setHeader('WWW-Authenticate', 'Basic realm="Simple File Server"');
      return res.status(401).json({ error: 'Authentication required' });
    }
  
    // Parse credentials
    const credentials = parseAuthHeader(authHeader);
    
    if (!credentials) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Simple File Server"');
      return res.status(401).json({ error: 'Invalid authentication format' });
    }
  
    // Validate user
    const userStatus = validateUser(credentials.username, credentials.password);
    
    if (!userStatus.isAuthenticated) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Simple File Server"');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  
    // If validation is successful, save user info to request object
    req.user = userStatus;
    next();
  }
}

// Write permission check middleware
function writePermissionMiddleware(req, res, next) {
  // If userRules is not configured, permission check is disabled
  if (!config.userRules || config.userRules.length === 0) {
    return next();
  }

  // Check if user has write permission
  if (!req.user || !req.user.permissions || !req.user.permissions.includes('w')) {
    return res.status(403).json({ error: 'Write permission required' });
  }

  next();
}

module.exports = {
  authMiddleware,
  writePermissionMiddleware
}; 