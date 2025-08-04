import { pgTable, varchar, timestamp, integer } from "drizzle-orm/pg-core";

// Create the users table with prefix for filtering
export const users = pgTable("8slp_users", {
  email: varchar("email", { length: 255 }).primaryKey(),
  eightUserId: varchar("eight_user_id", { length: 255 }).notNull(),
  eightAccessToken: varchar("eight_access_token", { length: 512 }).notNull(),
  eightRefreshToken: varchar("eight_refresh_token", { length: 512 }).notNull(),
  eightTokenExpiresAt: timestamp("eight_token_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create the user temperature profiles table with prefix for filtering
export const userTemperatureProfile = pgTable(
  "8slp_user_temperature_profiles",
  {
    email: varchar("email", { length: 255 }).primaryKey(),
    bedTime: varchar("bed_time", { length: 15 }).notNull(), // Store as HH:MM:SS.ssssss
    wakeupTime: varchar("wakeup_time", { length: 15 }).notNull(), // Store as HH:MM:SS.ssssss
    initialSleepLevel: integer("initial_sleep_level").notNull(),
    midStageSleepLevel: integer("mid_stage_sleep_level").notNull(),
    finalSleepLevel: integer("final_sleep_level").notNull(),
    timezoneTZ: varchar("timezone_tz", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Export types for use in other files
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type UserTemperatureProfile = typeof userTemperatureProfile.$inferSelect;
export type UserTemperatureProfileInsert =
  typeof userTemperatureProfile.$inferInsert;
