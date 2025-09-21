-- CreateTable
CREATE TABLE "8slp_users" (
    "email" TEXT NOT NULL,
    "eight_user_id" TEXT NOT NULL,
    "eight_access_token" TEXT NOT NULL,
    "eight_refresh_token" TEXT NOT NULL,
    "eight_token_expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "8slp_users_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "8slp_user_temperature_profiles" (
    "email" TEXT NOT NULL,
    "bed_time" TEXT NOT NULL,
    "wakeup_time" TEXT NOT NULL,
    "initial_sleep_level" INTEGER NOT NULL,
    "mid_stage_sleep_level" INTEGER NOT NULL,
    "final_sleep_level" INTEGER NOT NULL,
    "timezone_tz" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "8slp_user_temperature_profiles_pkey" PRIMARY KEY ("email")
);

-- AddForeignKey
ALTER TABLE "8slp_user_temperature_profiles" ADD CONSTRAINT "8slp_user_temperature_profiles_email_fkey" FOREIGN KEY ("email") REFERENCES "8slp_users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
