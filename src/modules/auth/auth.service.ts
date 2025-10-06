import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@modules/users/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid email');

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid password');

    const accessToken = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await this.usersService.update(user.id, { refreshToken: await bcrypt.hash(refreshToken, 10) });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new UnauthorizedException('Email already exists');
    }

    const user = await this.usersService.create(registerDto);

    const accessToken = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  public generateToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn', '1h'),
    });
  }

  public generateRefreshToken(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn', '1h'),
    });
  }

  async validateUser(userId: string): Promise<User | null> {
    const user = await this.usersService.findOne(userId);
    if (!user) return null;
    return user;
  }

  async validateUserRoles(userId: string, requiredRoles: string[]): Promise<boolean> {
    const user = await this.usersService.findOne(userId);
    if (!user) return false;
    if (!requiredRoles.includes(user.role)) return false;
    return true;
  }

  async verifyRefreshToken(refreshToken: string, userId: string): Promise<User> {
    try {
      const user = await this.usersService.findOne(userId);
      const authenticated = await bcrypt.compare(refreshToken, user.refreshToken);
      if (!authenticated) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return user;
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
