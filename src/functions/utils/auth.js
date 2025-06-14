/**
 * 用户认证相关工具函数
 */

// 生成JWT令牌
export async function generateToken(payload, env) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 24 * 7; // 7天过期
  
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(tokenPayload));
  
  const signature = await generateSignature(`${encodedHeader}.${encodedPayload}`, env.JWT_SECRET);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// 验证JWT令牌
export async function verifyToken(token, env) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    // 验证签名
    const expectedSignature = await generateSignature(`${encodedHeader}.${encodedPayload}`, env.JWT_SECRET);
    if (signature !== expectedSignature) {
      return { valid: false, message: '无效的令牌签名' };
    }
    
    // 解析载荷
    const payload = JSON.parse(atob(encodedPayload));
    
    // 检查令牌是否过期
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, message: '令牌已过期' };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, message: '令牌解析错误' };
  }
}

// 生成签名
async function generateSignature(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 密码哈希函数
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// 验证密码
export async function verifyPassword(password, hashedPassword) {
  const hash = await hashPassword(password);
  return hash === hashedPassword;
}

// 认证中间件
export async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未授权访问' }, 401);
  }
  
  const token = authHeader.substring(7);
  const { valid, payload, message } = await verifyToken(token, c.env);
  
  if (!valid) {
    return c.json({ error: message || '无效的令牌' }, 401);
  }
  
  // 将用户信息添加到请求上下文
  c.set('user', payload);
  
  return next();
}
