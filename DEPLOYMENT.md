# Deployment Guide

This guide covers the deployment configuration for the Cross-Domain Recommendation Engine to Vercel and Supabase.

## Overview

The application is configured for production deployment with:
- **Frontend & API**: Vercel (Next.js)
- **Database**: Supabase PostgreSQL
- **Authentication**: Clerk
- **Monitoring**: Vercel Analytics + Supabase monitoring
- **CI/CD**: GitHub Actions

## Prerequisites

### Required Accounts
- [Vercel](https://vercel.com) account
- [Supabase](https://supabase.com) account  
- [Clerk](https://clerk.com) account
- GitHub repository with Actions enabled

### Required CLI Tools
```bash
npm install -g vercel@latest
npm install -g supabase@latest
```

## Environment Setup

### 1. Vercel Configuration

#### Install Vercel CLI and Login
```bash
npm install -g vercel@latest
vercel login
```

#### Link Project
```bash
cd cross-domain-recommendation-engine
vercel link
```

#### Set Environment Variables
```bash
# Production environment variables
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add QLOO_API_KEY production
vercel env add GEMINI_API_KEY production
vercel env add NEXT_PUBLIC_APP_URL production
```

### 2. Supabase Configuration

#### Create Production Project
```bash
# Create new project
supabase projects create cross-domain-recommendation-engine

# Get project reference
supabase projects list
```

#### Configure Database
```bash
# Link to production project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
npm run migrate:prod
```

### 3. GitHub Secrets

Add the following secrets to your GitHub repository:

#### Vercel Secrets
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

#### Supabase Secrets
- `SUPABASE_PROJECT_REF`: Production project reference
- `SUPABASE_ACCESS_TOKEN`: Supabase access token

#### Application Secrets
- `QLOO_API_KEY`: Qloo API key
- `GEMINI_API_KEY`: Google Gemini API key

#### Optional Monitoring
- `SLACK_WEBHOOK_URL`: For deployment notifications

## Deployment Process

### Automatic Deployment

The application automatically deploys when:
- Code is pushed to `main` branch (production)
- Code is pushed to `develop` branch (staging)
- Pull requests are opened (preview deployments)

### Manual Deployment

#### Production
```bash
# Deploy to production
vercel --prod

# Or trigger GitHub Action
gh workflow run deploy.yml
```

#### Staging
```bash
# Deploy to staging
vercel

# Or trigger GitHub Action
gh workflow run staging.yml
```

## Database Migrations

### Production Migrations
```bash
# Run migrations against production
NODE_ENV=production npm run migrate:prod

# Create backup before migration
npm run db:backup
```

### Local Development
```bash
# Start local Supabase
npm run supabase:start

# Run migrations locally
npm run migrate

# Reset local database
npm run supabase:reset
```

## Monitoring & Analytics

### Vercel Analytics
- Automatically enabled in production
- View metrics at: https://vercel.com/dashboard/analytics
- Custom events tracked via `/src/lib/monitoring.ts`

### Supabase Monitoring
- Database metrics: Supabase Dashboard > Settings > Database
- API usage: Supabase Dashboard > Settings > API
- Custom monitoring: `/api/admin/monitoring`

### Application Health
- Health check endpoint: `/api/health`
- Admin monitoring: `/api/admin/monitoring`
- Error tracking: Supabase `error_logs` table

## Security Configuration

### Environment Variables
- Never commit `.env.local` to version control
- Use `.env.example` as template
- Set production variables in Vercel dashboard

### Database Security
- Row Level Security (RLS) enabled
- Service role key for server-side operations only
- Anon key for client-side operations

### API Security
- Rate limiting enabled
- CORS configured for production domains
- Security headers configured in `vercel.json`

## Performance Optimization

### Caching
- Redis caching for API responses
- Next.js static generation where possible
- CDN caching via Vercel Edge Network

### Database
- Connection pooling enabled
- Query optimization
- Proper indexing on frequently queried columns

## Troubleshooting

### Common Issues

#### Deployment Fails
```bash
# Check build logs
vercel logs

# Test build locally
npm run build
```

#### Database Connection Issues
```bash
# Test database connection
npm run migrate -- --dry-run

# Check Supabase status
supabase status
```

#### Environment Variables
```bash
# List Vercel environment variables
vercel env ls

# Pull environment variables locally
vercel env pull .env.local
```

### Health Checks

#### Application Health
```bash
curl https://your-domain.vercel.app/api/health
```

#### Database Health
```bash
# Check via admin endpoint (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.vercel.app/api/admin/monitoring?type=health
```

## Rollback Procedures

### Application Rollback
```bash
# Rollback to previous deployment
vercel rollback

# Or redeploy specific commit
vercel --prod --force
```

### Database Rollback
```bash
# Restore from backup
supabase db restore backup-TIMESTAMP.sql --project-ref YOUR_REF
```

## Maintenance

### Regular Tasks
- Monitor error logs weekly
- Review performance metrics monthly
- Update dependencies quarterly
- Backup database weekly (automated)

### Scaling Considerations
- Vercel automatically scales based on traffic
- Supabase connection limits: monitor usage
- Consider Redis cluster for high traffic
- Database read replicas for heavy read workloads

## Support

### Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

### Monitoring Dashboards
- Vercel: https://vercel.com/dashboard
- Supabase: https://app.supabase.com/projects
- Application: `/dashboard` (admin users)

### Emergency Contacts
- DevOps Team: [Contact Information]
- Database Admin: [Contact Information]
- API Provider Support: [Contact Information]