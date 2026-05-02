# Skill: Security & Compliance Engineer

## Description
Expert in application security, RBAC implementation, data protection, and compliance requirements for fintech/logistics platforms in Egypt and MENA.

## When to Use
- Implementing authentication and authorization
- Reviewing code for security vulnerabilities
- Setting up data protection measures
- Designing audit logging
- Handling PII (Personally Identifiable Information)

## Authentication Patterns

### JWT with Refresh Tokens
```typescript
@Injectable()
export class AuthService {
  async login(phone: string, password: string): Promise<AuthResponse> {
    const user = await this.validateUser(phone, password);
    
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' }, 
      { expiresIn: '7d' }
    );
    
    // Store refresh token hash in Redis
    await this.redis.set(`refresh:${user.id}`, await hash(refreshToken), 'EX', 604800);
    
    return { accessToken, refreshToken, expiresIn: 900 };
  }
}
```

### OTP Verification
```typescript
async requestOTP(phone: string): Promise<void> {
  const otp = generateRandomDigits(4);
  
  // Store in Redis with 5-minute expiry
  await this.redis.set(`otp:${phone}`, otp, 'EX', 300);
  
  // Send via WhatsApp/SMS
  await this.notificationService.sendOTP(phone, otp);
}

async verifyOTP(phone: string, otp: string): Promise<boolean> {
  const stored = await this.redis.get(`otp:${phone}`);
  if (!stored || stored !== otp) {
    // Increment attempt counter
    const attempts = await this.redis.incr(`otp-attempts:${phone}`);
    if (attempts >= 3) {
      await this.redis.del(`otp:${phone}`);
      throw new ForbiddenException('Too many attempts. Request new OTP.');
    }
    return false;
  }
  
  // Clear OTP after successful verification
  await this.redis.del(`otp:${phone}`);
  await this.redis.del(`otp-attempts:${phone}`);
  return true;
}
```

## RBAC Implementation

### Decorators
```typescript
// roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// permissions.decorator.ts
export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);
```

### Guards
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) return true;
    
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()]
    );
    
    if (!requiredPermissions) return true;
    
    const { user } = context.switchToHttp().getRequest();
    return requiredPermissions.every(p => user.permissions.includes(p));
  }
}
```

### Controller Usage
```typescript
@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentController {
  
  @Get()
  @Roles('OPERATIONS_MANAGER', 'FINANCE_ADMIN')
  @Permissions('shipments:read:all')
  async findAll() { }

  @Patch(':id/status')
  @Roles('COURIER', 'OPERATIONS_MANAGER')
  @Permissions('shipments:update:status')
  async updateStatus() { }
  
  @Patch(':id/status/override')
  @Roles('OPERATIONS_MANAGER')
  @Permissions('shipments:update:status:override')
  async overrideStatus() { }
}
```

## Data Protection

### PII Masking
```typescript
function maskPhone(phone: string): string {
  // Egyptian format: 01xxxxx123
  if (phone.length !== 11) return phone;
  return phone.slice(0, 4) + '*****' + phone.slice(-3);
}

function maskIBAN(iban: string): string {
  return '****' + iban.slice(-4);
}
```

### Secure Logging
```typescript
@Injectable()
export class SecureLogger {
  info(message: string, context?: any): void {
    const sanitized = this.sanitize(context);
    this.logger.info(message, sanitized);
  }

  private sanitize(obj: any): any {
    if (!obj) return obj;
    
    const sensitiveFields = ['password', 'otp', 'iban', 'creditCard', 'ssn'];
    const result = { ...obj };
    
    for (const field of sensitiveFields) {
      if (result[field]) result[field] = '***REDACTED***';
    }
    
    if (result.customerPhone) result.customerPhone = maskPhone(result.customerPhone);
    
    return result;
  }
}
```

## Rate Limiting

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = `rate-limit:${request.ip}:${request.route.path}`;
    
    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.expire(key, 60); // 1 minute window
    }
    
    if (current > 100) { // 100 requests per minute
      throw new HttpException('Too many requests', 429);
    }
    
    return true;
  }
}
```

## Audit Logging

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const action = `${request.method} ${request.route.path}`;
    
    return next.handle().pipe(
      tap(async (response) => {
        await this.auditService.log({
          userId: user?.id,
          action,
          entityType: context.getClass().name,
          entityId: request.params.id,
          oldValue: request.body, // Store before/after for updates
          newValue: response,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      })
    );
  }
}
```

## Security Checklist

### For Every Endpoint
- [ ] Authentication required (unless explicitly public)
- [ ] Authorization checked (@Roles, @Permissions)
- [ ] Input validated (class-validator DTOs)
- [ ] Rate limiting applied
- [ ] Sensitive data masked in logs

### For Financial Operations
- [ ] Database transaction wraps all changes
- [ ] Optimistic locking on wallet updates
- [ ] Idempotency key for payment operations
- [ ] Audit log created
- [ ] Admin notification for large amounts

### For File Uploads
- [ ] File type validation
- [ ] File size limits
- [ ] Virus scanning (if applicable)
- [ ] Store outside web root
- [ ] Use signed URLs for access

### Data Storage
- [ ] Passwords hashed with bcrypt (cost factor 12+)
- [ ] Tokens encrypted at rest
- [ ] PII encrypted in database (if required by law)
- [ ] Backups encrypted
- [ ] SSL/TLS for all connections

## Compliance Requirements (Egypt)

### Data Residency
- Personal data must be stored within Egypt
- Use AWS Cairo region or local hosting
- Cross-border transfer requires regulatory approval

### Financial Regulations
- Maintain transaction records for 10 years
- Report suspicious transactions to FIU
- Implement AML/KYC procedures for merchants

## Example Usage
User: "I need to implement role-based access for the finance dashboard"
→ Use this skill to create the RBAC decorators, guards, and permission matrix for finance operations.
