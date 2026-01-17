#!/usr/bin/env tsx
/**
 * Test the complete cron job logic with both sides
 * Run with: npx tsx test-cron-final.ts
 */

import { db } from "./src/server/db";
import { adjustTemperature } from "./src/app/api/temperatureCron/route";

async function testCronJob() {
  try {
    console.log("🧪 Testing complete cron job logic...\n");
    
    // Run the cron job with a test time that should trigger heating
    const testTime = new Date();
    console.log(`Test time: ${testTime.toISOString()}`);
    console.log("(Make sure your profile times are set to trigger heating now)\n");
    
    await adjustTemperature({
      enabled: true,
      currentTime: testTime,
    });
    
    console.log("\n✅ Cron job completed!");
    console.log("\n🎯 Check your Eight Sleep app:");
    console.log("   LEFT side (yours): Should match your configured temperature");
    console.log("   RIGHT side (partner): Should match partner's configured temperature");
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

testCronJob().catch(console.error);
