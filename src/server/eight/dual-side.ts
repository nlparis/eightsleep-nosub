// dual-side.ts - Functions for controlling both sides of Eight Sleep Pod independently

import { z } from "zod";
import { fetchWithAuth, getDeviceData } from "./eight";
import { getUserProfile } from "./user";
import { type Token } from "./types";
import { CLIENT_API_URL } from "./constants";

// Types for dual-side control
export interface DualSideDeviceData {
  deviceId: string;
  ownerId: string;
  leftUserId: string;
  rightUserId: string;
  leftHeatingLevel: number;
  leftTargetHeatingLevel: number;
  leftNowHeating: boolean;
  leftHeatingDuration: number;
  rightHeatingLevel: number;
  rightTargetHeatingLevel: number;
  rightNowHeating: boolean;
  rightHeatingDuration: number;
  leftKelvin: {
    targetLevels: number[];
    level: number;
    currentTargetLevel: number;
    active: boolean;
    currentActivity: string;
  };
  rightKelvin: {
    targetLevels: number[];
    level: number;
    currentTargetLevel: number;
    active: boolean;
    currentActivity: string;
  };
}

export type BedSide = "left" | "right" | "both";

export interface SideHeatingStatus {
  side: BedSide;
  userId: string;
  heatingLevel: number;
  targetHeatingLevel: number;
  isHeating: boolean;
  heatingDuration: number;
  currentActivity: string;
  active: boolean;
}

// Get heating status for a specific side
export async function getSideHeatingStatus(
  token: Token,
  side: BedSide,
): Promise<SideHeatingStatus | SideHeatingStatus[]> {
  const userProfile = await getUserProfile(token);
  const deviceId = userProfile.devices[0]!;
  const deviceData = (await getDeviceData(
    token,
    deviceId,
  )) as DualSideDeviceData;

  if (side === "both") {
    return [
      {
        side: "left",
        userId: deviceData.leftUserId,
        heatingLevel: deviceData.leftHeatingLevel,
        targetHeatingLevel: deviceData.leftTargetHeatingLevel,
        isHeating: deviceData.leftNowHeating,
        heatingDuration: deviceData.leftHeatingDuration,
        currentActivity: deviceData.leftKelvin?.currentActivity ?? "",
        active: deviceData.leftKelvin?.active ?? false,
      },
      {
        side: "right",
        userId: deviceData.rightUserId,
        heatingLevel: deviceData.rightHeatingLevel,
        targetHeatingLevel: deviceData.rightTargetHeatingLevel,
        isHeating: deviceData.rightNowHeating,
        heatingDuration: deviceData.rightHeatingDuration,
        currentActivity: deviceData.rightKelvin?.currentActivity ?? "",
        active: deviceData.rightKelvin?.active ?? false,
      },
    ];
  }

  const isLeft = side === "left";
  const kelvinData = isLeft ? deviceData.leftKelvin : deviceData.rightKelvin;
  
  return {
    side,
    userId: isLeft ? deviceData.leftUserId : deviceData.rightUserId,
    heatingLevel: isLeft
      ? deviceData.leftHeatingLevel
      : deviceData.rightHeatingLevel,
    targetHeatingLevel: isLeft
      ? deviceData.leftTargetHeatingLevel
      : deviceData.rightTargetHeatingLevel,
    isHeating: isLeft ? deviceData.leftNowHeating : deviceData.rightNowHeating,
    heatingDuration: isLeft
      ? deviceData.leftHeatingDuration
      : deviceData.rightHeatingDuration,
    currentActivity: kelvinData?.currentActivity ?? "",
    active: kelvinData?.active ?? false,
  };
}

// Note: This function is no longer needed since we use setBedSide to switch between sides
// Keeping for backward compatibility in case it's used elsewhere
export async function getSideUserIds(
  token: Token,
): Promise<{ leftUserId: string; rightUserId: string }> {
  // Both sides are controlled by the same authenticated user
  // We switch between sides using setBedSide before making API calls
  return {
    leftUserId: token.eightUserId,
    rightUserId: token.eightUserId,
  };
}

// Turn on the bed (activate heating) for a specific side
export async function turnOnSide(token: Token, side: BedSide): Promise<void> {
  const userProfile = await getUserProfile(token);
  const userId = token.eightUserId;
  const deviceId = userProfile.devices[0]!;
  const userRegisteredSide = userProfile.currentDevice.side;

  const sidesToControl: Side[] = side === "both" ? ["left", "right"] : [side as Side];

  console.log(`[DUAL-SIDE] User registered side: ${userRegisteredSide}`);
  console.log(`[DUAL-SIDE] Turning on ${side} side with user ID: ${userId}`);

  for (const bedSide of sidesToControl) {
    console.log(`[DUAL-SIDE] Attempting to control ${bedSide} side (user is on ${userRegisteredSide})`);
    
    // First, tell Eight Sleep which side we want to control
    await setBedSide(token, userId, deviceId, bedSide);
    
    // Verify the side was actually set
    const updatedProfile = await getUserProfile(token);
    console.log(`[DUAL-SIDE] After setBedSide, currentDevice.side is: ${updatedProfile.currentDevice.side}`);

    // Then turn on heating for that side
    const url = `${APP_API_URL}v1/users/${userId}/temperature`;
    const data = {
      currentState: {
        type: "smart",
      },
      timeBased: {
        level: 0,
        durationSeconds: 3600,
      },
      currentLevel: 0,
    };

    console.log(`[DUAL-SIDE] Turning on heating for ${bedSide} side:`, url);

    try {
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log(`[DUAL-SIDE] Successfully turned on ${bedSide} side`);
    } catch (error) {
      console.error(
        `[DUAL-SIDE] Failed to turn on heating for ${bedSide} side:`,
        error,
      );
      throw error;
    }
  }
}

// Set manual heating level for a specific side
export async function setSideHeatingLevel(
  token: Token,
  side: BedSide,
  level: number,
  duration = 0,
): Promise<void> {
  const userProfile = await getUserProfile(token);
  const userId = token.eightUserId;
  const deviceId = userProfile.devices[0]!;
  const userRegisteredSide = userProfile.currentDevice.side;

  const sidesToControl: Side[] = side === "both" ? ["left", "right"] : [side as Side];

  console.log(
    `[DUAL-SIDE] User registered side: ${userRegisteredSide}`,
  );
  console.log(
    `[DUAL-SIDE] Setting heating level ${level} for ${side} side with user ID: ${userId}`,
  );

  // First turn on the bed for all sides
  await turnOnSide(token, side);

  for (const bedSide of sidesToControl) {
    console.log(`[DUAL-SIDE] Attempting to set temperature for ${bedSide} side (user is on ${userRegisteredSide})`);
    
    // Tell Eight Sleep which side we want to control
    await setBedSide(token, userId, deviceId, bedSide);
    
    // Verify the side was actually set
    const updatedProfile = await getUserProfile(token);
    console.log(`[DUAL-SIDE] After setBedSide, currentDevice.side is: ${updatedProfile.currentDevice.side}`);

    // Then set the temperature for that side
    const url = `${APP_API_URL}v1/users/${userId}/temperature`;
    const data = {
      timeBased: { level, durationSeconds: duration },
      currentLevel: level,
    };

    console.log(
      `[DUAL-SIDE] Setting temperature for ${bedSide} side:`,
      url,
      data,
    );

    try {
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log(`[DUAL-SIDE] Successfully set temperature for ${bedSide} side to ${level}`);
    } catch (error) {
      console.error(
        `[DUAL-SIDE] Failed to set temperature for ${bedSide} side:`,
        error,
      );
      throw error;
    }
  }
}

// Turn off heating for a specific side
export async function turnOffSide(token: Token, side: BedSide): Promise<void> {
  const userProfile = await getUserProfile(token);
  const userId = token.eightUserId;
  const deviceId = userProfile.devices[0]!;

  const sidesToControl: Side[] = side === "both" ? ["left", "right"] : [side as Side];

  console.log(`[DUAL-SIDE] Turning off ${side} side with user ID: ${userId}`);

  for (const bedSide of sidesToControl) {
    console.log(`[DUAL-SIDE] Setting current side to: ${bedSide}`);
    
    // Tell Eight Sleep which side we want to control
    await setBedSide(token, userId, deviceId, bedSide);

    // Then turn off heating for that side
    const url = `${APP_API_URL}v1/users/${userId}/temperature`;
    const data = { currentState: { type: "off" } };

    console.log(`[DUAL-SIDE] Turning off heating for ${bedSide} side:`, url);

    try {
      await fetchWithAuth(url, token, z.object({}), {
        method: "PUT",
        body: JSON.stringify(data),
      });
      console.log(`[DUAL-SIDE] Successfully turned off ${bedSide} side`);
    } catch (error) {
      console.error(
        `[DUAL-SIDE] Failed to turn off heating for ${bedSide} side:`,
        error,
      );
      throw error;
    }
  }
}

// Get temperature settings for a specific side
export async function getSideTemperatureSettings(
  token: Token,
  side: BedSide,
): Promise<any> {
  const sideUserIds = await getSideUserIds(token);

  if (side === "both") {
    const [leftSettings, rightSettings] = await Promise.all([
      fetchWithAuth(
        `${APP_API_URL}v1/users/${sideUserIds.leftUserId}/temperature`,
        token,
        z.any(),
      ),
      fetchWithAuth(
        `${APP_API_URL}v1/users/${sideUserIds.rightUserId}/temperature`,
        token,
        z.any(),
      ),
    ]);

    return {
      left: leftSettings,
      right: rightSettings,
    };
  }

  const userId =
    side === "left" ? sideUserIds.leftUserId : sideUserIds.rightUserId;
  return fetchWithAuth(
    `${APP_API_URL}v1/users/${userId}/temperature`,
    token,
    z.any(),
  );
}

// NEW APPROACH: Control both sides using /devices endpoint
// This is the CORRECT way that doesn't change user's registered side

export async function setDeviceTemperatures(
  token: Token,
  options: {
    leftLevel?: number | null;
    rightLevel?: number | null;
    duration?: number;
  },
): Promise<void> {
  const userProfile = await getUserProfile(token);
  const deviceId = userProfile.devices[0]!;
  const deviceData = (await getDeviceData(token, deviceId)) as any;

  console.log(
    `[DUAL-SIDE-V2] Setting device temperatures - left: ${options.leftLevel ?? "unchanged"}, right: ${options.rightLevel ?? "unchanged"}`,
  );

  const duration = options.duration ?? 10800; // Default 3 hours

  // Build the update payload
  const updateData: any = {
    ledBrightnessLevel: deviceData.ledBrightnessLevel ?? 50,
  };

  // Set left side if specified
  if (options.leftLevel !== undefined && options.leftLevel !== null) {
    updateData.leftTargetHeatingLevel = options.leftLevel;
    updateData.leftHeatingDuration = duration;
    updateData.leftNowHeating = true;
    console.log(`[DUAL-SIDE-V2] Setting LEFT to ${options.leftLevel}`);
  }

  // Set right side if specified
  if (options.rightLevel !== undefined && options.rightLevel !== null) {
    updateData.rightTargetHeatingLevel = options.rightLevel;
    updateData.rightHeatingDuration = duration;
    updateData.rightNowHeating = true;
    console.log(`[DUAL-SIDE-V2] Setting RIGHT to ${options.rightLevel}`);
  }

  const url = `${CLIENT_API_URL}/devices/${deviceId}`;
  console.log(`[DUAL-SIDE-V2] Updating device:`, url);
  console.log(`[DUAL-SIDE-V2] Payload:`, updateData);

  try {
    await fetchWithAuth(url, token, z.object({}), {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
    console.log(`[DUAL-SIDE-V2] Successfully updated device temperatures`);
  } catch (error) {
    console.error(`[DUAL-SIDE-V2] Failed to update device:`, error);
    throw error;
  }
}

export async function turnOffDeviceSide(
  token: Token,
  side: "left" | "right" | "both",
): Promise<void> {
  const userProfile = await getUserProfile(token);
  const deviceId = userProfile.devices[0]!;
  const deviceData = (await getDeviceData(token, deviceId)) as any;

  console.log(`[DUAL-SIDE-V2] Turning off ${side} side(s)`);

  const updateData: any = {
    ledBrightnessLevel: deviceData.ledBrightnessLevel ?? 50,
  };

  if (side === "left" || side === "both") {
    updateData.leftTargetHeatingLevel = 0;
    updateData.leftHeatingDuration = 0;
    updateData.leftNowHeating = false;
  }

  if (side === "right" || side === "both") {
    updateData.rightTargetHeatingLevel = 0;
    updateData.rightHeatingDuration = 0;
    updateData.rightNowHeating = false;
  }

  const url = `${CLIENT_API_URL}/devices/${deviceId}`;
  
  try {
    await fetchWithAuth(url, token, z.object({}), {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
    console.log(`[DUAL-SIDE-V2] Successfully turned off ${side} side(s)`);
  } catch (error) {
    console.error(`[DUAL-SIDE-V2] Failed to turn off ${side}:`, error);
    throw error;
  }
}

// Convenience functions for common operations
export const dualSide = {
  // Get status for both sides
  getStatus: (token: Token) => getSideHeatingStatus(token, "both"),

  // Set different temperatures for each side (NEW METHOD)
  setTemperatures: setDeviceTemperatures,

  // Turn off one or both sides (NEW METHOD)
  turnOff: turnOffDeviceSide,

  // DEPRECATED: Old methods that use setBedSide (don't use these)
  onBoth: (token: Token) => turnOnSide(token, "both"),
  setBothSides: (token: Token, level: number, duration = 0) =>
    setSideHeatingLevel(token, "both", level, duration),
  setDifferentSides: async (
    token: Token,
    leftLevel: number,
    rightLevel: number,
    duration = 0,
  ) => {
    await Promise.all([
      setSideHeatingLevel(token, "left", leftLevel, duration),
      setSideHeatingLevel(token, "right", rightLevel, duration),
    ]);
  },
  offBoth: (token: Token) => turnOffSide(token, "both"),
};
