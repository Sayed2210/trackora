# Skill: DevOps Engineer

## Description
Expert in deploying, monitoring, and scaling NestJS applications on AWS with Docker, CI/CD pipelines, and infrastructure as code.

## When to Use
- Setting up deployment infrastructure
- Creating Docker configurations
- Designing CI/CD pipelines
- Configuring monitoring and alerting
- Scaling applications
- Database migration strategies

## AWS Infrastructure

### ECS Fargate Setup
```yaml
# docker-compose.yml for local development
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/trackora
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: trackora
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Dockerfile
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
```

### ECS Task Definition
```json
{
  "family": "trackora-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "${ECR_REPOSITORY}:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:..."
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/trackora-api",
          "awslogs-region": "me-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: me-south-1
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -t trackora:$GITHUB_SHA .
          docker tag trackora:$GITHUB_SHA $ECR_REGISTRY/trackora:$GITHUB_SHA
          docker push $ECR_REGISTRY/trackora:$GITHUB_SHA

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: me-south-1
      - run: |
          aws ecs update-service \
            --cluster trackora-cluster \
            --service trackora-api \
            --force-new-deployment
```

## Database Migration Strategy

### Zero-Downtime Migrations
```bash
#!/bin/bash
# migrate.sh

set -e

echo "Running database migrations..."

# 1. Backup database
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Run migrations
npx prisma migrate deploy

# 3. Verify
npx prisma migrate status

# 4. Generate client
npx prisma generate

echo "Migrations complete!"
```

### Blue-Green Deployment for Schema Changes
```typescript
// For breaking schema changes:
// 1. Deploy code that supports BOTH old and new schema
// 2. Run migration
// 3. Deploy code that uses ONLY new schema
// 4. Clean up old code

// Example: Adding a required column
// Step 1: Add column as nullable
// Step 2: Backfill data
// Step 3: Make column required
// Step 4: Deploy code that relies on column
```

## Monitoring & Alerting

### CloudWatch Metrics
```typescript
// metrics.service.ts
@Injectable()
export class MetricsService {
  constructor(private cloudWatch: CloudWatchClient) {}

  async recordMetric(
    name: string,
    value: number,
    unit: StandardUnit = StandardUnit.Count
  ): Promise<void> {
    await this.cloudWatch.send(
      new PutMetricDataCommand({
        Namespace: 'Trackora/API',
        MetricData: [
          {
            MetricName: name,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: process.env.NODE_ENV },
            ],
          },
        ],
      })
    );
  }
}
```

### Health Checks
```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database'),
      () => this.redis.pingCheck('cache'),
    ]);
  }
}
```

### Alerting Rules
```yaml
# CloudWatch alarms
HighCPUAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: Trackora-HighCPU
    MetricName: CPUUtilization
    Namespace: AWS/ECS
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSTopic

HighErrorRateAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: Trackora-HighErrorRate
    MetricName: 5xxErrorRate
    Namespace: AWS/ApplicationELB
    Statistic: Average
    Period: 300
    EvaluationPeriods: 1
    Threshold: 5
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSTopic
```

## Scaling Strategy

### Horizontal Scaling (ECS)
```typescript
// Auto-scaling configuration
const scaling = new aws.appautoscaling.Target('trackora_scaling', {
  maxCapacity: 10,
  minCapacity: 2,
  resourceId: `service/trackora-cluster/trackora-api`,
  scalableDimension: 'ecs:service:DesiredCount',
  serviceNamespace: 'ecs',
});

new aws.appautoscaling.Policy('trackora_cpu_policy', {
  policyType: 'TargetTrackingScaling',
  resourceId: scaling.resourceId,
  scalableDimension: scaling.scalableDimension,
  serviceNamespace: scaling.serviceNamespace,
  targetTrackingScalingPolicyConfiguration: {
    predefinedMetricSpecification: {
      predefinedMetricType: 'ECSServiceAverageCPUUtilization',
    },
    targetValue: 70,
    scaleInCooldown: 300,
    scaleOutCooldown: 60,
  },
});
```

### Database Scaling
- **Read Replicas:** For reporting and analytics queries
- **Connection Pooling:** PgBouncer for high concurrency
- **Partitioning:** Time-series tables (status logs, transactions)

### Redis Scaling
- **Cluster Mode:** For production with multiple shards
- **ElastiCache:** Managed Redis with failover

## Backup Strategy

### Database Backups
```bash
# Automated daily backups via RDS
# Point-in-time recovery enabled
# Cross-region backup for disaster recovery

# Manual backup before major deployments
pg_dump --format=custom --file=pre-deploy-backup.dump $DATABASE_URL
```

### File Backups (S3)
```typescript
// Enable versioning and cross-region replication
const bucket = new aws.s3.Bucket('trackora-files', {
  versioning: { enabled: true },
  replicationConfiguration: {
    role: replicationRole.arn,
    rules: [{
      id: 'replica',
      status: 'Enabled',
      destination: {
        bucket: backupBucket.arn,
      },
    }],
  },
});
```

## Environment Management

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
AWS_REGION=me-south-1

# Optional (with defaults)
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
RATE_LIMIT_MAX=100
```

### Secrets Management
```typescript
// Use AWS Secrets Manager or Parameter Store
const secret = await secretsManager.getSecretValue({
  SecretId: 'trackora/production/database',
}).promise();

const databaseUrl = JSON.parse(secret.SecretString).url;
```

## Example Usage
User: "Set up auto-scaling for the API based on CPU and request count"
→ Use this skill to create ECS auto-scaling policies, CloudWatch alarms, and target tracking configuration.
