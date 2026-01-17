# Partner Side Temperature Control - API Limitation

## Summary
**Partner side automation is NOT currently possible with the Eight Sleep API when using a single account.**

## Root Cause Investigation

### What We Discovered
After implementing the full dual-side control feature and investigating the Eight Sleep API, we found:

1. **Device Data Does Not Include User IDs**
   - The `/devices/{deviceId}` API endpoint returns heating levels for both sides
   - It does NOT return `leftUserId` or `rightUserId` fields
   - Only returns: `deviceId`, `leftHeatingLevel`, `rightHeatingLevel`, etc.

2. **Temperature Control Requires User-Specific IDs**
   - The temperature control endpoint is: `/v1/users/{userId}/temperature`
   - Each Eight Sleep account has ONE user ID
   - That user ID can only control the side associated with that account

3. **No Device-Level Temperature API**
   - There is no `/devices/{deviceId}/temperature` endpoint
   - All temperature control goes through user-specific endpoints

### Test Results
- **Your side (Right)**: ✅ Works perfectly - you can automate your own side
- **Partner side (Left)**: ❌ Fails with 404 - your user ID cannot control their side

```
[DUAL-SIDE] Turning on left side, userIds: [ '052ad4e6637e48eaadd5c31512de265c' ]
[DUAL-SIDE] Failed to turn on heating for userId 052ad4e6637e48eaadd5c31512de265c: API request failed: 404
```

## Current Implementation

### What Works
- UI allows configuring partner profile ✅
- Database stores partner settings ✅
- Cron job processes both profiles ✅
- Your side (right) automation works perfectly ✅
- Partner side errors are caught and logged gracefully ✅

### What Doesn't Work
- Actual API calls to control partner's side ❌
- Partner side always returns 404 ❌

## Possible Solutions

### Option 1: Partner Authentication (Not Implemented)
**Would require:**
- Adding a second login form for partner
- Storing partner's Eight Sleep credentials securely
- Managing two separate authentication tokens
- Refreshing both tokens independently

**Pros:**
- Would enable true dual-side automation
- Each side controlled by correct account

**Cons:**
- Security concerns storing two sets of credentials
- More complex authentication flow
- Partner must have their own Eight Sleep account
- Doubles token management complexity

### Option 2: Manual Control via Eight Sleep App (Current Recommendation)
**What to do:**
- Keep using automated control for YOUR side
- Your partner controls their side via Eight Sleep's official app
- They can set schedules in the Eight Sleep app directly

**Pros:**
- No security concerns
- Uses official Eight Sleep features
- No complex dual-authentication needed

**Cons:**
- Partner's side not automated via your app
- Two separate control systems

### Option 3: Contact Eight Sleep for API Access
Some device APIs have special endpoints for:
- Device-level control (not user-specific)
- Family/household account features
- Shared device management

**Recommendation:** Contact Eight Sleep support to ask if there's a way to control both sides from one account.

## Code Status

### What Was Implemented
1. ✅ Database schema with partner profile fields
2. ✅ UI for configuring partner temperature schedules
3. ✅ Backend tRPC routes handling partner data
4. ✅ Cron job logic processing both sides
5. ✅ Error handling for failed partner API calls
6. ✅ Graceful degradation (your side still works)

### Files Modified
- `prisma/schema.prisma` - Added partner fields
- `src/server/api/routers/user.ts` - Updated tRPC procedures
- `src/app/api/temperatureCron/route.ts` - Dual-side processing logic
- `src/components/temperatureProfileForm.tsx` - Partner UI section
- `src/server/eight/dual-side.ts` - Attempted dual-side API integration

## Recommendation

**Keep the partner profile feature in the UI** but add a notice explaining:
- Partner side automation requires partner's Eight Sleep login
- Currently only your side is automated
- Partner should use Eight Sleep app for their side
- Future enhancement could add partner authentication

The infrastructure is built and ready - it just needs either:
1. Partner authentication feature, OR
2. Eight Sleep API changes to support family accounts

## For Future Development

If implementing partner authentication:
1. Add partner email/password fields (separate from main user)
2. Create separate token storage for partner
3. Update cron job to use correct token for each side
4. Handle two separate token refresh flows
5. Add UI to manage both accounts

The rest of the code is already in place and working!
