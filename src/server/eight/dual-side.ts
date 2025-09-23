// dual-side.ts - Functions for controlling both sides of Eight Sleep Pod independently

import { z } from "zod";
import { fetchWithAuth, getDeviceData } from "./eight";
import { getUserProfile } from "./user";
import { type Token } from "./types";
import { APP_API_URL } from "./constants";

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
        currentActivity: deviceData.leftKelvin.currentActivity,
        active: deviceData.leftKelvin.active,
      },
      {
        side: "right",
        userId: deviceData.rightUserId,
        heatingLevel: deviceData.rightHeatingLevel,
        targetHeatingLevel: deviceData.rightTargetHeatingLevel,
        isHeating: deviceData.rightNowHeating,
        heatingDuration: deviceData.rightHeatingDuration,
        currentActivity: deviceData.rightKelvin.currentActivity,
        active: deviceData.rightKelvin.active,
      },
    ];
  }

  const isLeft = side === "left";
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
    currentActivity: isLeft
      ? deviceData.leftKelvin.currentActivity
      : deviceData.rightKelvin.currentActivity,
    active: isLeft
      ? deviceData.leftKelvin.active
      : deviceData.rightKelvin.active,
  };
}

// Get user IDs for both sides
export async function getSideUserIds(
  token: Token,
): Promise<{ leftUserId: string; rightUserId: string }> {
  const userProfile = await getUserProfile(token);
  const deviceId = userProfile.devices[0]!;
  const deviceData = (await getDeviceData(
    token,
    deviceId,
  )) as DualSideDeviceData;

  return {
    leftUserId: deviceData.leftUserId,
    rightUserId: deviceData.rightUserId,
  };
}

// Turn on the bed (activate heating) for a specific side
export async function turnOnSide(token: Token, side: BedSide): Promise<void> {
  const sideUserIds = await getSideUserIds(token);

  const userIds =
    side === "both"
      ? [sideUserIds.leftUserId, sideUserIds.rightUserId]
      : [side === "left" ? sideUserIds.leftUserId : sideUserIds.rightUserId];

  const promises = userIds.map(async (userId) => {
    const url = `${APP_API_URL}/v1/users/${userId}/temperature`;
    // This is the structure for turning on the bed
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

    return fetchWithAuth(url, token, z.object({}), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  });

  await Promise.all(promises);
}

// Set manual heating level for a specific side
export async function setSideHeatingLevel(
  token: Token,
  side: BedSide,
  level: number,
  duration = 0,
): Promise<void> {
  const sideUserIds = await getSideUserIds(token);

  const userIds =
    side === "both"
      ? [sideUserIds.leftUserId, sideUserIds.rightUserId]
      : [side === "left" ? sideUserIds.leftUserId : sideUserIds.rightUserId];

  // First turn on the bed for all sides
  await turnOnSide(token, side);

  const promises = userIds.map(async (userId) => {
    const url = `${APP_API_URL}/v1/users/${userId}/temperature`;
    const data = {
      timeBased: { level, durationSeconds: duration },
      currentLevel: level,
      currentState: { type: "timeBased" },
    };

    return fetchWithAuth(url, token, z.object({}), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  });

  await Promise.all(promises);
}

// Turn off heating for a specific side
export async function turnOffSide(token: Token, side: BedSide): Promise<void> {
  const sideUserIds = await getSideUserIds(token);

  const userIds =
    side === "both"
      ? [sideUserIds.leftUserId, sideUserIds.rightUserId]
      : [side === "left" ? sideUserIds.leftUserId : sideUserIds.rightUserId];

  const promises = userIds.map(async (userId) => {
    const url = `${APP_API_URL}/v1/users/${userId}/temperature`;
    const data = { currentState: { type: "off" } };

    return fetchWithAuth(url, token, z.object({}), {
      method: "PUT",
      body: JSON.stringify(data),
    });
  });

  await Promise.all(promises);
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
        `${APP_API_URL}/v1/users/${sideUserIds.leftUserId}/temperature`,
        token,
        z.any(),
      ),
      fetchWithAuth(
        `${APP_API_URL}/v1/users/${sideUserIds.rightUserId}/temperature`,
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
    `${APP_API_URL}/v1/users/${userId}/temperature`,
    token,
    z.any(),
  );
}

// Convenience functions for common operations
export const dualSide = {
  // Get status for both sides
  getStatus: (token: Token) => getSideHeatingStatus(token, "both"),

  // Turn on both sides (activate heating)
  onBoth: (token: Token) => turnOnSide(token, "both"),

  // Set both sides to same temperature
  setBothSides: (token: Token, level: number, duration = 0) =>
    setSideHeatingLevel(token, "both", level, duration),

  // Set different temperatures for each side
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

  // Turn off both sides
  offBoth: (token: Token) => turnOffSide(token, "both"),
};
