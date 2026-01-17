#!/usr/bin/env tsx
/**
 * Test controlling BOTH sides independently using /devices endpoint
 * Run with: npx tsx test-both-sides.ts
 */

import { db } from "./src/server/db";
import { getDeviceData, fetchWithAuth } from "./src/server/eight/eight";
import { getUserProfile, setBedSide } from "./src/server/eight/user";
import type { Token } from "./src/server/eight/types";
import { CLIENT_API_URL } from "./src/server/eight/constants";
import { z } from "zod";

async function testBothSides() {
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

    // Get current state
    const profile = await getUserProfile(token);
    const deviceId = profile.devices[0]!;
    console.log("🛏️  Device ID:", deviceId);
    console.log("📍 Current registered side:", profile.currentDevice.side);

    const deviceData = await getDeviceData(token, deviceId) as any;
    console.log("\n📊 Current heating levels:");
    console.log("  Left:", deviceData.leftHeatingLevel, "target:", deviceData.leftTargetHeatingLevel);
    console.log("  Right:", deviceData.rightHeatingLevel, "target:", deviceData.rightTargetHeatingLevel);

    // STEP 1: Restore your original side (left) if needed
    if (profile.currentDevice.side !== "left") {
      console.log("\n🔄 Restoring your original side (left)...");
      await setBedSide(token, token.eightUserId, deviceId, "left");
      const restored = await getUserProfile(token);
      console.log("✅ Restored to:", restored.currentDevice.side);
      console.log("   (Your app should now show you on LEFT, partner on RIGHT)");
      console.log("   Please verify in your app, then press Enter to continue...");
      
      // Give user time to check
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // STEP 2: Control BOTH sides independently using /devices endpoint
    console.log("\n🎯 Setting temperatures for BOTH sides:");
    console.log("  LEFT (your side): -40 (cool)");
    console.log("  RIGHT (partner's side): 60 (warm)");

    try {
      const url = `${CLIENT_API_URL}/devices/${deviceId}`;
      const data = {
        ledBrightnessLevel: deviceData.ledBrightnessLevel || 50,
        leftHeatingDuration: 10800,      // 3 hours
        leftTargetHeatingLevel: -40,     // Your side: COOL
        leftNowHeating: true,
        rightHeatingDuration: 10800,     // 3 hours
        rightTargetHeatingLevel: 60,     // Partner's side: WARM
        rightNowHeating: true,
      };
      
      console.log("\n📤 Calling:", url);
      console.log("📦 Data:", JSON.stringify(data, null, 2));
      
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      
      console.log("\n✅ SUCCESS! Updated both sides!");
      
      // Wait a moment then check status
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const updatedData = await getDeviceData(token, deviceId) as any;
      console.log("\n📊 New heating levels:");
      console.log("  Left (your side):", updatedData.leftHeatingLevel, "target:", updatedData.leftTargetHeatingLevel);
      console.log("  Right (partner's side):", updatedData.rightHeatingLevel, "target:", updatedData.rightTargetHeatingLevel);
      
      console.log("\n🎉 Check your Eight Sleep app:");
      console.log("   LEFT side (yours): Should show -4 (-40) COOL");
      console.log("   RIGHT side (partner): Should show +6 (60) WARM");
      
    } catch (error: any) {
      console.log("❌ Failed:", error.message);
      console.log("Full error:", error);
    }

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

testBothSides().catch(console.error);
