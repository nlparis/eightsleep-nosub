#!/usr/bin/env tsx
/**
 * Test different approaches to control partner's side WITHOUT using setBedSide
 * Run with: npx tsx test-partner-side-v2.ts
 */

import { db } from "./src/server/db";
import { getDeviceData, fetchWithAuth } from "./src/server/eight/eight";
import { getUserProfile } from "./src/server/eight/user";
import type { Token } from "./src/server/eight/types";
import { APP_API_URL, CLIENT_API_URL } from "./src/server/eight/constants";
import { z } from "zod";

async function testPartnerControl() {
  try {
    console.log("🔍 Fetching user from database...");
    const user = await db.user.findFirst({
      where: { email: "nick.paris987@gmail.com" },
    });

    if (!user) {
      console.error("❌ User not found!");
      return;
    }

    const token: Token = {
      eightAccessToken: user.eightAccessToken!,
      eightRefreshToken: user.eightRefreshToken!,
      eightExpiresAtPosix: user.eightTokenExpiresAt!.getTime(),
      eightUserId: user.eightUserId!,
    };

    console.log("✅ User found:", user.email);
    console.log("👤 User ID:", user.eightUserId);

    // Get device data
    const profile = await getUserProfile(token);
    const deviceId = profile.devices[0]!;
    console.log("🛏️  Device ID:", deviceId);
    console.log("📍 Current registered side:", profile.currentDevice.side);

    const deviceData = await getDeviceData(token, deviceId) as any;
    console.log("\n📊 Device data:");
    console.log("  leftUserId:", deviceData.leftUserId);
    console.log("  rightUserId:", deviceData.rightUserId);
    console.log("  ownerId:", deviceData.ownerId);
    console.log("  Left heating:", deviceData.leftHeatingLevel, "target:", deviceData.leftTargetHeatingLevel);
    console.log("  Right heating:", deviceData.rightHeatingLevel, "target:", deviceData.rightTargetHeatingLevel);

    // HYPOTHESIS 1: Use leftUserId/rightUserId if they exist and are different
    console.log("\n🧪 HYPOTHESIS 1: Use leftUserId or rightUserId for API calls");
    if (deviceData.leftUserId && deviceData.rightUserId) {
      console.log("✅ Found both side user IDs!");
      console.log("  leftUserId:", deviceData.leftUserId);
      console.log("  rightUserId:", deviceData.rightUserId);
      
      if (deviceData.leftUserId !== deviceData.rightUserId) {
        console.log("🎯 Different user IDs! Trying to control right side with rightUserId...");
        try {
          const url = `${APP_API_URL}v1/users/${deviceData.rightUserId}/temperature`;
          const data = {
            timeBased: { level: 50, durationSeconds: 0 },
            currentLevel: 50,
          };
          console.log("  Calling:", url);
          console.log("  Data:", data);
          
          await fetchWithAuth(url, token, z.object({}), {
            method: "PUT",
            body: JSON.stringify(data),
          });
          console.log("✅ SUCCESS! Set right side to 50 using rightUserId");
          console.log("   Check app: RIGHT side should show +5 (50)");
          
          return; // Exit if this works
        } catch (error: any) {
          console.log("❌ Failed:", error.message);
        }
      } else {
        console.log("⚠️  Both sides have same user ID:", deviceData.leftUserId);
      }
    } else {
      console.log("❌ leftUserId/rightUserId not found in device data");
    }

    // HYPOTHESIS 2: Use device endpoint with side-specific parameters
    console.log("\n🧪 HYPOTHESIS 2: Use /devices endpoint with side parameter");
    try {
      const url = `${CLIENT_API_URL}/devices/${deviceId}`;
      const data = {
        ledBrightnessLevel: deviceData.ledBrightnessLevel || 50,
        leftHeatingDuration: 0,
        leftTargetHeatingLevel: 0,
        rightHeatingDuration: 10800,
        rightTargetHeatingLevel: 50, // Set RIGHT side to 50
      };
      console.log("  Calling:", url);
      console.log("  Data:", data);
      
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log("✅ SUCCESS! Updated device with right side heating");
      console.log("   Check app: RIGHT side should show +5 (50)");
      
      return; // Exit if this works
    } catch (error: any) {
      console.log("❌ Failed:", error.message);
    }

    // HYPOTHESIS 3: Try APP_API with different URL structure
    console.log("\n🧪 HYPOTHESIS 3: Try /devices/{deviceId}/temperature endpoint");
    try {
      const url = `${APP_API_URL}v1/devices/${deviceId}/temperature`;
      const data = {
        side: "right",
        timeBased: { level: 50, durationSeconds: 0 },
        currentLevel: 50,
      };
      console.log("  Calling:", url);
      console.log("  Data:", data);
      
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log("✅ SUCCESS! Set right side to 50 using device endpoint");
      console.log("   Check app: RIGHT side should show +5 (50)");
      
      return; // Exit if this works
    } catch (error: any) {
      console.log("❌ Failed:", error.message);
    }

    // HYPOTHESIS 4: Try CLIENT_API user temperature endpoint with side
    console.log("\n🧪 HYPOTHESIS 4: Use CLIENT_API /users/{userId}/temperature with side");
    try {
      const url = `${CLIENT_API_URL}/users/${token.eightUserId}/temperature`;
      const data = {
        side: "right",
        timeBased: { level: 50, durationSeconds: 0 },
        currentLevel: 50,
      };
      console.log("  Calling:", url);
      console.log("  Data:", data);
      
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log("✅ SUCCESS! Set right side to 50");
      console.log("   Check app: RIGHT side should show +5 (50)");
      
      return; // Exit if this works
    } catch (error: any) {
      console.log("❌ Failed:", error.message);
    }

    // HYPOTHESIS 5: Try updating device with rightNowHeating flag
    console.log("\n🧪 HYPOTHESIS 5: Update device with rightNowHeating=true");
    try {
      const url = `${CLIENT_API_URL}/devices/${deviceId}`;
      const data = {
        rightNowHeating: true,
        rightTargetHeatingLevel: 50,
        rightHeatingDuration: 10800,
      };
      console.log("  Calling:", url);
      console.log("  Data:", data);
      
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log("✅ SUCCESS! Updated right side heating flags");
      console.log("   Check app: RIGHT side should show +5 (50)");
      
      return; // Exit if this works
    } catch (error: any) {
      console.log("❌ Failed:", error.message);
    }

    console.log("\n😞 All hypotheses failed. The API may require:");
    console.log("   1. Partner's separate credentials");
    console.log("   2. A different authentication scope");
    console.log("   3. Physical access to pair both sides to one account");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

testPartnerControl().catch(console.error);
