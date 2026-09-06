import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { GymsModule } from "@/gyms/gyms.module";
import { UsersModule } from "@/users/users.module";
import { StaffController } from "@/staff/staff.controller";

/** Owner-facing staff management. The account rows are plain users. */
@Module({
  imports: [UsersModule, GymsModule, AuthModule],
  controllers: [StaffController],
})
export class StaffModule {}
