import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { GymsModule } from "@/gyms/gyms.module";
import { UsersModule } from "@/users/users.module";
import { AuthController } from "@/auth/auth.controller";
import { AuthService } from "@/auth/auth.service";
import { PasswordService } from "@/auth/password.service";
import { TokensService } from "@/auth/tokens.service";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "@/auth/schemas/refresh-token.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    // Global because the app-wide JwtAuthGuard verifies access tokens outside
    // this module. Secrets are passed per call, so access and refresh material
    // can be signed with different keys.
    JwtModule.register({ global: true }),
    UsersModule,
    GymsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokensService],
  exports: [AuthService, PasswordService, TokensService],
})
export class AuthModule {}
