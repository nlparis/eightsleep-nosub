#!/usr/bin/env tsx
/**
 * Quick test script to control the partner's LEFT side
 * Run with: npx tsx test-partner-side.ts
 */

import { db } from "./src/server/db";
import { setSideHeatingLevel, turnOnSide, getSideHeatingStatus } from "./src/server/eight/dual-side";
import { getUserProfile, setBedSide } from "./src/server/eight/user";
import type { Token } from "./src/server/eight/types";

async function testPartnerSide() {
  try {
    console.log("🔍 Fetching user from database...");
    const user = await db.user.findFirst({
      where: {
        email: "nick.paris987@gmail.com",
      },
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

    // Get initial status
    console.log("\n📊 Getting initial heating status for both sides...");
    const initialStatus = await getSideHeatingStatus(token, "both");
    if (Array.isArray(initialStatus)) {
      console.log("API 'left' (your RIGHT physical):", initialStatus[0]);
      console.log("API 'right' (partner's LEFT physical):", initialStatus[1]);
    }

    // Get current user profile to see registered side
    console.log("\n🔍 Getting user profile...");
    const profile = await getUserProfile(token);
    console.log("📍 User registered side:", profile.currentDevice.side);
    console.log("🛏️  Device ID:", profile.devices[0]);

    // Test controlling the partner's LEFT physical side
    // Your account: registered to "left" but you physically sleep on RIGHT
    // So: API "left" = your RIGHT physical side, API "right" = partner's LEFT physical side
    console.log("\n🎯 Testing PARTNER (LEFT physical) side control...");
    console.log("Setting API 'right' (partner's LEFT physical side) to level 40 (warm)...\n");

    // Method 1: Use setBedSide then set temperature
    console.log("--- Method 1: setBedSide + temperature ---");
    const deviceId = profile.devices[0]!;
    const userId = token.eightUserId;
    
    console.log("1️⃣ Switching to API 'right' side (partner's LEFT physical)...");
    await setBedSide(token, userId, deviceId, "right");
    
    // Verify the switch
    const afterSwitch = await getUserProfile(token);
    console.log("✅ After setBedSide, current side:", afterSwitch.currentDevice.side);
    
    console.log("2️⃣ Setting temperature on API 'right' to 40...");
    await setSideHeatingLevel(token, "right", 40);
    
    // Check status after
    console.log("\n📊 Getting final status...");
    const finalStatus = await getSideHeatingStatus(token, "both");
    if (Array.isArray(finalStatus)) {
      console.log("API 'left' (your RIGHT physical):", finalStatus[0]);
      console.log("API 'right' (partner's LEFT physical):", finalStatus[1]);
    }
    
    // Check what side we're registered to now
    const finalProfile = await getUserProfile(token);
    console.log("\n📍 Final registered side:", finalProfile.currentDevice.side);
    
    console.log("\n✅ Test complete! Check your Eight Sleep app:");
    console.log("   - LEFT side (partner) should show +4 (40)");
    console.log("   - RIGHT side (yours) should remain unchanged");

  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

testPartnerSide().catch(console.error);
