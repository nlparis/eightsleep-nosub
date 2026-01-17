# Partner Side Temperature Control - Testing Guide

## Implementation Summary

The application has been successfully updated to support automated control of both sides of the Eight Sleep Pod. Here's what was implemented:

### 1. Database Schema Changes ✓
- Added 5 new optional fields to `UserTemperatureProfile`:
  - `partnerBedTime`
  - `partnerWakeupTime`
  - `partnerInitialSleepLevel`
  - `partnerMidStageSleepLevel`
  - `partnerFinalSleepLevel`
- All fields are nullable for backward compatibility
- Schema pushed to database successfully

### 2. API/Backend Changes ✓
- **tRPC Router** (`src/server/api/routers/user.ts`):
  - Updated input schema to accept optional partner profile fields
  - Modified upsert logic to save/clear partner fields
  
- **Cron Job** (`src/app/api/temperatureCron/route.ts`):
  - Refactored to use dual-side API functions from `dual-side.ts`
  - Created `processSideTemperature()` helper function
  - Processes right side (primary user) automatically
  - Processes left side (partner) when partner profile exists
  - Each side gets independent sleep cycle calculations and temperature adjustments

### 3. UI Changes ✓
- **Temperature Profile Form** (`src/components/temperatureProfileForm.tsx`):
  - Added "Your Side (Right)" section with blue/indigo styling
  - Added "Partner's Side (Left)" section with green styling
  - Checkbox to enable/disable partner automation
  - When enabled, shows identical configuration fields:
    - Bed time and wake-up time
    - Initial, mid-stage, and final sleep levels
    - Sleep duration calculation and validation
  - Form submission includes partner fields when enabled, sets to null when disabled

## Testing Instructions

### Manual UI Testing

1. **Start the development server:**
   ```bash
   pnpm run dev
   ```

2. **Navigate to the app** and log in with your Eight Sleep credentials

3. **Test Primary Profile Only:**
   - Configure your side (right) with your preferred settings
   - Leave partner profile disabled
   - Save and verify it works

4. **Test Enabling Partner Profile:**
   - Check the "Enable" checkbox in the Partner's Side section
   - Configure partner's bed time, wake-up time, and temperature levels
   - Verify sleep duration is calculated correctly
   - Save the profile

5. **Test Updating Both Profiles:**
   - Modify settings for both sides
   - Save and verify changes persist

6. **Test Disabling Partner Profile:**
   - Uncheck the "Enable" checkbox
   - Save and verify partner automation is removed

### Cron Job Testing

The cron job can be tested using the test mode parameter:

```bash
# Test at a specific time (Unix timestamp)
# Example: Test at 10 PM (22:00)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "http://localhost:3000/api/temperatureCron?testTime=UNIX_TIMESTAMP"
```

**Test Scenarios:**
1. **Pre-heating time** (1 hour before bed time)
2. **Bed time** (initial sleep level)
3. **Mid-stage** (1 hour after bed time)
4. **Final stage** (2 hours before wake-up)
5. **Wake-up time** (heating should turn off)

Check the console logs to verify:
- Both sides are processed independently
- Correct temperatures are set for each side
- Log messages show `[LEFT]` and `[RIGHT]` prefixes

### Verification Checklist

- [ ] Build completes without errors ✓
- [ ] UI displays both profile sections correctly
- [ ] Partner profile can be enabled/disabled
- [ ] Form validation works for both sides
- [ ] Data saves correctly to database
- [ ] Cron job processes right side (primary)
- [ ] Cron job processes left side (partner) when enabled
- [ ] Each side gets independent temperature control
- [ ] Disabling partner profile stops left side automation

## Key Implementation Details

- **User's side:** Right (as specified by user)
- **Partner's side:** Left
- **Authentication:** Single account controls both sides
- **API calls:** Uses `dual-side.ts` functions that handle side-specific user IDs automatically
- **Backward compatibility:** Existing profiles work without changes (partner fields are null)
- **Timezone:** Partner uses the same timezone as primary user

## Files Modified

1. `prisma/schema.prisma` - Added partner profile fields
2. `src/server/api/routers/user.ts` - Updated tRPC procedures
3. `src/app/api/temperatureCron/route.ts` - Refactored for dual-side control
4. `src/components/temperatureProfileForm.tsx` - Added partner UI section

## Next Steps

1. Test the UI manually by logging in and configuring both profiles
2. Test the cron job with different timestamps to verify temperature adjustments
3. Monitor the logs when the cron runs to ensure both sides are controlled correctly
4. Verify in the Eight Sleep app that both sides respond to the automation
