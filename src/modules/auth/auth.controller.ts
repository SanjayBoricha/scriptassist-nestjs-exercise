import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@modules/users/entities/user.entity';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@ApiTags('auth')
@UseGuards(ThrottlerGuard)
@Throttle({})
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  refresh(@CurrentUser() user: User, @Body() _body: RefreshTokenDto) {
    const accessToken = this.authService.generateToken(user);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
