# Railway Cron Service (separate service in same project)
# Uses authenticated /api/cron endpoint
# Set CRON_SECRET in shared variables

# Schedule: daily at 06:00 UTC
# Command: curl -X POST https://$RAILWAY_PUBLIC_DOMAIN/api/cron -H "Authorization: Bearer $CRON_SECRET"

# To set up on Railway:
# 1. Create a new service in the same project, type: "Cron Job"
# 2. Set cron schedule to: 0 6 * * *
# 3. Set start command to the curl command above
# 4. Make sure CRON_SECRET is set in shared variables