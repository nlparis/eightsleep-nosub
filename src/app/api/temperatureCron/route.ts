import type { NextRequest } from "next/server";
import { db } from "~/server/db";
import { obtainFreshAccessToken } from "~/server/eight/auth";
import { type Token } from "~/server/eight/types";
import { getSideHeatingStatus, setDeviceTemperatures } from "~/server/eight/dual-side";

export const runtime = "nodejs";

function createDateWithTime(baseDate: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(":").map(Number);
  if (
    hours === undefined ||
    minutes === undefined ||
    isNaN(hours) ||
    isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid time string: ${timeString}`);
  }
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isWithinTimeRange(
  current: Date,
  target: Date,
  rangeMinutes: number,
): boolean {
  const diffMs = Math.abs(current.getTime() - target.getTime());
  return diffMs <= rangeMinutes * 60 * 1000;
}

async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  retries = 3,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, i)),
      );
    }
  }
  throw new Error(
    "This should never happen due to the for loop, but TypeScript doesn't know that",
  );
}

interface SleepCycle {
  preHeatingTime: Date;
  bedTime: Date;
  midStageTime: Date;
  finalStageTime: Date;
  wakeupTime: Date;
}

function createSleepCycle(
  baseDate: Date,
  bedTimeStr: string,
  wakeupTimeStr: string,
): SleepCycle {
  const preHeatingTime = createDateWithTime(baseDate, bedTimeStr);
  preHeatingTime.setHours(preHeatingTime.getHours() - 1); // Set pre-heating to 1 hour before bedtime

  const bedTime = createDateWithTime(baseDate, bedTimeStr);
  let wakeupTime = createDateWithTime(baseDate, wakeupTimeStr);

  // Adjust wakeupTime if it's before bedTime (i.e., it's on the next day)
  if (wakeupTime <= bedTime) {
    wakeupTime = addDays(wakeupTime, 1);
  }

  const midStageTime = new Date(bedTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours after bed time
  const finalStageTime = new Date(wakeupTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before wake-up

  return { preHeatingTime, bedTime, midStageTime, finalStageTime, wakeupTime };
}

function adjustTimeToCurrentCycle(
  cycleStart: Date,
  currentTime: Date,
  timeInCycle: Date,
): Date {
  let adjustedTime = new Date(timeInCycle);

  // If the time in the cycle is before the cycle start, it means it's on the next day
  if (timeInCycle < cycleStart) {
    adjustedTime = addDays(adjustedTime, 1);
  }

  // If the adjusted time is in the future relative to the current time, move it back by one day
  if (
    adjustedTime > currentTime &&
    adjustedTime.getTime() - currentTime.getTime() > 12 * 60 * 60 * 1000
  ) {
    adjustedTime = addDays(adjustedTime, -1);
  }

  return adjustedTime;
}

interface TestMode {
  enabled: boolean;
  currentTime: Date;
}

interface SideProfile {
  bedTime: string;
  wakeupTime: string;
  initialSleepLevel: number;
  midStageSleepLevel: number;
  finalSleepLevel: number;
}

// Calculate what temperature a side should be set to (or null to turn off)
async function calculateSideTemperature(
  token: Token,
  side: "left" | "right",
  sideProfile: SideProfile,
  userNow: Date,
  userEmail: string,
  testMode?: TestMode,
): Promise<number | null> {
  const logLabel = side === "left" ? "LEFT (User)" : "RIGHT (Partner)";
  
  // Create the sleep cycle for this side
        const sleepCycle = createSleepCycle(
          userNow,
    sideProfile.bedTime,
    sideProfile.wakeupTime,
        );

        // Adjust all times in the cycle to the current day
        const cycleStart = sleepCycle.preHeatingTime;
        const adjustedCycle: SleepCycle = {
          preHeatingTime: adjustTimeToCurrentCycle(
            cycleStart,
            userNow,
            sleepCycle.preHeatingTime,
          ),
          bedTime: adjustTimeToCurrentCycle(
            cycleStart,
            userNow,
            sleepCycle.bedTime,
          ),
          midStageTime: adjustTimeToCurrentCycle(
            cycleStart,
            userNow,
            sleepCycle.midStageTime,
          ),
          finalStageTime: adjustTimeToCurrentCycle(
            cycleStart,
            userNow,
            sleepCycle.finalStageTime,
          ),
          wakeupTime: adjustTimeToCurrentCycle(
            cycleStart,
            userNow,
            sleepCycle.wakeupTime,
          ),
        };

        let heatingStatus;
        if (testMode?.enabled) {
    heatingStatus = { isHeating: false, heatingLevel: 0 };
  } else {
    try {
      const sideStatus = await retryApiCall(() =>
        getSideHeatingStatus(token, side),
      );
      if (Array.isArray(sideStatus)) {
        throw new Error("Expected single side status");
      }
      if (!sideStatus) {
        console.warn(
          `[${logLabel}] No heating status returned, defaulting to off`,
        );
        heatingStatus = { isHeating: false, heatingLevel: 0 };
        } else {
        heatingStatus = {
          isHeating: sideStatus.isHeating ?? false,
          heatingLevel: sideStatus.heatingLevel ?? 0,
        };
      }
    } catch (error) {
      console.error(
        `[${logLabel}] Error getting heating status:`,
        error instanceof Error ? error.message : String(error),
      );
      // Default to off state if we can't get status
      heatingStatus = { isHeating: false, heatingLevel: 0 };
    }
        }

        console.log(
    `[${logLabel}] Current heating status for user ${userEmail}:`,
          JSON.stringify(heatingStatus),
        );
  console.log(`[${logLabel}] Adjusted times for user ${userEmail}:`);
        console.log(
    `  Pre-heating: ${adjustedCycle.preHeatingTime.toISOString()}`,
  );
  console.log(`  Bed time: ${adjustedCycle.bedTime.toISOString()}`);
  console.log(`  Mid stage: ${adjustedCycle.midStageTime.toISOString()}`);
  console.log(`  Final stage: ${adjustedCycle.finalStageTime.toISOString()}`);
  console.log(`  Wake-up: ${adjustedCycle.wakeupTime.toISOString()}`);

        const isNearPreHeating = isWithinTimeRange(
          userNow,
          adjustedCycle.preHeatingTime,
          15,
        );
        const isNearBedTime = isWithinTimeRange(
          userNow,
          adjustedCycle.bedTime,
          15,
        );
        const isNearMidStage = isWithinTimeRange(
          userNow,
          adjustedCycle.midStageTime,
          15,
        );
        const isNearFinalStage = isWithinTimeRange(
          userNow,
          adjustedCycle.finalStageTime,
          15,
        );
        const isNearWakeup = isWithinTimeRange(
          userNow,
          adjustedCycle.wakeupTime,
          15,
        );

        // Determine if we should be heating and what temperature
        if (
          isNearPreHeating ||
          isNearBedTime ||
          isNearMidStage ||
          isNearFinalStage ||
          isNearWakeup
        ) {
          let targetLevel: number;
          let sleepStage: string;

          if (
            isNearPreHeating ||
            (isNearBedTime && userNow < adjustedCycle.bedTime)
          ) {
            targetLevel = sideProfile.initialSleepLevel;
            sleepStage = "pre-heating";
          } else if (
            isNearBedTime ||
            (isNearMidStage && userNow < adjustedCycle.midStageTime)
          ) {
            targetLevel = sideProfile.initialSleepLevel;
            sleepStage = "initial";
          } else if (
            isNearMidStage ||
            (isNearFinalStage && userNow < adjustedCycle.finalStageTime)
          ) {
            targetLevel = sideProfile.midStageSleepLevel;
            sleepStage = "mid";
          } else {
            targetLevel = sideProfile.finalSleepLevel;
            sleepStage = "final";
          }

          console.log(
            `[${logLabel}] Should be heating at ${targetLevel} for ${sleepStage} stage`,
          );
          return targetLevel;
        } else if (
          heatingStatus.isHeating &&
          userNow > adjustedCycle.wakeupTime &&
          !isWithinTimeRange(userNow, adjustedCycle.wakeupTime, 15)
        ) {
          // Turn off heating if it's more than 15 minutes past wake-up time
          console.log(`[${logLabel}] Should turn off heating (past wake-up time)`);
          return null;
        } else {
          console.log(
            `[${logLabel}] No temperature change needed`,
          );
          return heatingStatus.isHeating ? heatingStatus.heatingLevel : null;
        }
}

export async function adjustTemperature(testMode?: TestMode): Promise<void> {
  try {
    const profiles = await db.userTemperatureProfile.findMany({
      include: {
        user: true,
      },
    });

    for (const profile of profiles) {
      try {
        let token: Token = {
          eightAccessToken: profile.user.eightAccessToken,
          eightRefreshToken: profile.user.eightRefreshToken,
          eightExpiresAtPosix: profile.user.eightTokenExpiresAt.getTime(),
          eightUserId: profile.user.eightUserId,
        };

        const now = testMode?.enabled ? testMode.currentTime : new Date();

        if (!testMode?.enabled && now.getTime() > token.eightExpiresAtPosix) {
          token = await obtainFreshAccessToken(
            token.eightRefreshToken,
            token.eightUserId,
          );
          await db.user.update({
            where: { email: profile.user.email },
            data: {
              eightAccessToken: token.eightAccessToken,
              eightRefreshToken: token.eightRefreshToken,
              eightTokenExpiresAt: new Date(token.eightExpiresAtPosix),
            },
          });
        }

        const userNow = new Date(
          now.toLocaleString("en-US", {
            timeZone: profile.timezoneTZ,
          }),
        );

        console.log(
          `User's current time: ${userNow.toISOString()} for user ${profile.user.email}`,
        );

        // Check if partner profile exists
        // Type assertion for partner fields that were just added to the schema
        const profileWithPartner = profile as typeof profile & {
          partnerBedTime?: string | null;
          partnerWakeupTime?: string | null;
          partnerInitialSleepLevel?: number | null;
          partnerMidStageSleepLevel?: number | null;
          partnerFinalSleepLevel?: number | null;
        };

        const hasPartnerProfile = !!(
          profileWithPartner.partnerBedTime &&
          profileWithPartner.partnerWakeupTime &&
          profileWithPartner.partnerInitialSleepLevel !== null &&
          profileWithPartner.partnerMidStageSleepLevel !== null &&
          profileWithPartner.partnerFinalSleepLevel !== null
        );

        // Calculate temperatures for BOTH sides
        // User sleeps on LEFT side, Partner sleeps on RIGHT side
        const primaryProfile: SideProfile = {
          bedTime: profile.bedTime,
          wakeupTime: profile.wakeupTime,
          initialSleepLevel: profile.initialSleepLevel,
          midStageSleepLevel: profile.midStageSleepLevel,
          finalSleepLevel: profile.finalSleepLevel,
        };

        // Determine user's (right side) temperature
        const userTargetTemp: number | null = await calculateSideTemperature(
          token,
          "right",
          primaryProfile,
          userNow,
          profile.user.email,
          testMode,
        );

        // Determine partner's (left side) temperature if profile exists
        let partnerTargetTemp: number | null = null;
        if (hasPartnerProfile) {
          console.log(
            `Partner profile detected for user ${profile.user.email}, processing partner side`,
          );
          const partnerProfile: SideProfile = {
            bedTime: profileWithPartner.partnerBedTime!,
            wakeupTime: profileWithPartner.partnerWakeupTime!,
            initialSleepLevel: profileWithPartner.partnerInitialSleepLevel!,
            midStageSleepLevel: profileWithPartner.partnerMidStageSleepLevel!,
            finalSleepLevel: profileWithPartner.partnerFinalSleepLevel!,
          };

          partnerTargetTemp = await calculateSideTemperature(
            token,
            "left",
            partnerProfile,
            userNow,
            profile.user.email,
            testMode,
          );
        }

        // Apply temperatures to BOTH sides in a single API call
        try {
            console.log(
            `[DEVICE] Setting temperatures - RIGHT (user): ${userTargetTemp ?? "off"}, LEFT (partner): ${partnerTargetTemp ?? "off"}`,
          );

          if (!testMode?.enabled) {
            await retryApiCall<void>(async () => {
              await setDeviceTemperatures(token, {
                rightLevel: userTargetTemp,
                leftLevel: partnerTargetTemp,
              });
            });
          } else {
            console.log(
              `[TEST MODE] Would set - RIGHT: ${userTargetTemp ?? "off"}, LEFT: ${partnerTargetTemp ?? "off"}`,
            );
          }

          console.log(`[DEVICE] Successfully updated both sides`);
        } catch (error) {
          console.error(
            `[DEVICE] Error setting temperatures for user ${profile.user.email}:`,
            error instanceof Error ? error.message : String(error),
          );
        }

        console.log(
          `Successfully completed temperature adjustment check for user ${profile.user.email}`,
        );
      } catch (error) {
        console.error(
          `Error adjusting temperature for user ${profile.user.email}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  } catch (error) {
    console.error(
      "Error fetching user profiles:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  } else {
    try {
      const testTimeParam = request.nextUrl.searchParams.get("testTime");
      if (testTimeParam) {
        const testTime = new Date(Number(testTimeParam) * 1000);
        if (isNaN(testTime.getTime())) {
          throw new Error("Invalid testTime parameter");
        }
        console.log(
          `[TEST MODE] Running temperature adjustment cron job with test time: ${testTime.toISOString()}`,
        );
        await adjustTemperature({ enabled: true, currentTime: testTime });
      } else {
        await adjustTemperature();
      }
      return Response.json({ success: true });
    } catch (error) {
      console.error(
        "Error in temperature adjustment cron job:",
        error instanceof Error ? error.message : String(error),
      );
      return new Response("Internal server error", { status: 500 });
    }
  }
}
