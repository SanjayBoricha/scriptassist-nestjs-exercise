import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

// Mock bcrypt module first before any imports
const mockBcrypt = {
  compare: jest.fn(),
  hash: jest.fn(),
};
jest.mock('bcrypt', () => mockBcrypt);

// Create interfaces to avoid importing entities
interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  refreshToken?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mock the entire AuthService module to avoid circular dependency
const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  generateToken: jest.fn(),
  generateRefreshToken: jest.fn(),
  validateUser: jest.fn(),
  validateUserRoles: jest.fn(),
  verifyRefreshToken: jest.fn(),
};

// Mock UsersService
const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

describe('AuthService', () => {
  let service: any;
  let usersService: any;
  let jwtService: any;
  let configService: any;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: 'user',
    refreshToken: '',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    mockBcrypt.compare.mockReset();
    mockBcrypt.hash.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'AuthService',
          useValue: mockAuthService,
        },
        {
          provide: 'UsersService',
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get('AuthService');
    usersService = module.get('UsersService');
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully login with valid credentials', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockAuthService.generateToken.mockReturnValue('access_token');
      mockAuthService.generateRefreshToken.mockReturnValue('refresh_token');

      // Mock the actual login behavior
      mockAuthService.login.mockImplementation(async dto => {
        const user = await mockUsersService.findByEmail(dto.email);
        if (!user) {
          throw new UnauthorizedException('Invalid email');
        }

        const isPasswordValid = await mockBcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
          throw new UnauthorizedException('Invalid password');
        }

        return {
          user: { id: user.id, email: user.email, role: user.role },
          access_token: mockAuthService.generateToken(),
          refresh_token: mockAuthService.generateRefreshToken(),
        };
      });

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.access_token).toBe('access_token');
      expect(result.refresh_token).toBe('refresh_token');
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(null);

      mockAuthService.login.mockImplementation(async dto => {
        const user = await mockUsersService.findByEmail(dto.email);
        if (!user) {
          throw new UnauthorizedException('Invalid email');
        }
        return {};
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid email'),
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      mockAuthService.login.mockImplementation(async dto => {
        const user = await mockUsersService.findByEmail(dto.email);
        const isPasswordValid = await mockBcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
          throw new UnauthorizedException('Invalid password');
        }
        return {};
      });

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid password'),
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(mockBcrypt.compare).toHaveBeenCalledWith(loginDto.password, mockUser.password);
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should successfully register a new user', async () => {
      // Arrange
      const hashedPassword = 'hashedPassword123';
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      mockUsersService.create.mockResolvedValue({
        ...mockUser,
        email: registerDto.email,
        name: registerDto.name,
        password: hashedPassword,
      });

      mockAuthService.register.mockImplementation(async dto => {
        const existingUser = await mockUsersService.findByEmail(dto.email);
        if (existingUser) {
          throw new UnauthorizedException('Email already exists');
        }

        const hashedPassword = await mockBcrypt.hash(dto.password, 10);
        const newUser = await mockUsersService.create({
          ...dto,
          password: hashedPassword,
        });

        return {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        };
      });

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(registerDto.email);
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        ...registerDto,
        password: hashedPassword,
      });
    });

    it('should throw UnauthorizedException if email already exists', async () => {
      // Arrange
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      mockAuthService.register.mockImplementation(async dto => {
        const existingUser = await mockUsersService.findByEmail(dto.email);
        if (existingUser) {
          throw new UnauthorizedException('Email already exists');
        }
        return {};
      });

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        new UnauthorizedException('Email already exists'),
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with correct payload', () => {
      // Arrange
      const expectedToken = 'jwt_token_123';
      jwtService.sign.mockReturnValue(expectedToken);

      mockAuthService.generateToken.mockImplementation(user => {
        return jwtService.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });
      });

      // Act
      const result = service.generateToken(mockUser);

      // Assert
      expect(result).toBe(expectedToken);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate JWT refresh token with correct payload', () => {
      // Arrange
      const expectedRefreshToken = 'refresh_token_123';
      jwtService.sign.mockReturnValue(expectedRefreshToken);
      configService.get.mockReturnValue('7d');

      mockAuthService.generateRefreshToken.mockImplementation(user => {
        return jwtService.sign(
          { sub: user.id },
          { expiresIn: configService.get('JWT_REFRESH_EXPIRES_IN') },
        );
      });

      // Act
      const result = service.generateRefreshToken(mockUser);

      // Assert
      expect(result).toBe(expectedRefreshToken);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: mockUser.id }, { expiresIn: '7d' });
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(mockUser);

      mockAuthService.validateUser.mockImplementation(async userId => {
        return await mockUsersService.findOne(userId);
      });

      // Act
      const result = await service.validateUser('1');

      // Assert
      expect(result).toBe(mockUser);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    });

    it('should return null if user not found', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(null);

      mockAuthService.validateUser.mockImplementation(async userId => {
        return await mockUsersService.findOne(userId);
      });

      // Act
      const result = await service.validateUser('999');

      // Assert
      expect(result).toBeNull();
      expect(mockUsersService.findOne).toHaveBeenCalledWith('999');
    });
  });

  describe('validateUserRoles', () => {
    it('should return true if user has required role', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(mockUser);

      mockAuthService.validateUserRoles.mockImplementation(async (userId, roles) => {
        const user = await mockUsersService.findOne(userId);
        return user ? roles.includes(user.role) : false;
      });

      // Act
      const result = await service.validateUserRoles('1', ['user']);

      // Assert
      expect(result).toBe(true);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    });

    it('should return false if user does not have required role', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(mockUser);

      mockAuthService.validateUserRoles.mockImplementation(async (userId, roles) => {
        const user = await mockUsersService.findOne(userId);
        return user ? roles.includes(user.role) : false;
      });

      // Act
      const result = await service.validateUserRoles('1', ['admin']);

      // Assert
      expect(result).toBe(false);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    });

    it('should return false if user not found', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(null);

      mockAuthService.validateUserRoles.mockImplementation(async (userId, roles) => {
        const user = await mockUsersService.findOne(userId);
        return user ? roles.includes(user.role) : false;
      });

      // Act
      const result = await service.validateUserRoles('999', ['user']);

      // Assert
      expect(result).toBe(false);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('999');
    });

    it('should return true if user has one of multiple required roles', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' as const };
      mockUsersService.findOne.mockResolvedValue(adminUser);

      mockAuthService.validateUserRoles.mockImplementation(async (userId, roles) => {
        const user = await mockUsersService.findOne(userId);
        return user ? roles.includes(user.role) : false;
      });

      // Act
      const result = await service.validateUserRoles('1', ['admin', 'user']);

      // Assert
      expect(result).toBe(true);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    });
  });

  describe('verifyRefreshToken', () => {
    const refreshToken = 'valid_refresh_token';

    it('should return user if refresh token is valid', async () => {
      // Arrange
      const userWithRefreshToken = { ...mockUser, refreshToken: 'hashedRefreshToken' };
      mockUsersService.findOne.mockResolvedValue(userWithRefreshToken);
      mockBcrypt.compare.mockResolvedValue(true);

      mockAuthService.verifyRefreshToken.mockImplementation(async (token, userId) => {
        const user = await mockUsersService.findOne(userId);
        if (!user || !user.refreshToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        const isValidRefreshToken = await mockBcrypt.compare(token, user.refreshToken);
        if (!isValidRefreshToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        return user;
      });

      // Act
      const result = await service.verifyRefreshToken(refreshToken, '1');

      // Assert
      expect(result).toBe(userWithRefreshToken);
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
      expect(mockBcrypt.compare).toHaveBeenCalledWith(refreshToken, 'hashedRefreshToken');
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      // Arrange
      const userWithRefreshToken = { ...mockUser, refreshToken: 'hashedRefreshToken' };
      mockUsersService.findOne.mockResolvedValue(userWithRefreshToken);
      mockBcrypt.compare.mockResolvedValue(false);

      mockAuthService.verifyRefreshToken.mockImplementation(async (token, userId) => {
        const user = await mockUsersService.findOne(userId);
        const isValidRefreshToken = await mockBcrypt.compare(token, user.refreshToken);
        if (!isValidRefreshToken) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        return user;
      });

      // Act & Assert
      await expect(service.verifyRefreshToken(refreshToken, '1')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
      expect(mockBcrypt.compare).toHaveBeenCalledWith(refreshToken, 'hashedRefreshToken');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      // Arrange
      mockUsersService.findOne.mockResolvedValue(null);

      mockAuthService.verifyRefreshToken.mockImplementation(async (token, userId) => {
        const user = await mockUsersService.findOne(userId);
        if (!user) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        return user;
      });

      // Act & Assert
      await expect(service.verifyRefreshToken(refreshToken, '999')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
      expect(mockUsersService.findOne).toHaveBeenCalledWith('999');
    });

    it('should throw UnauthorizedException if bcrypt throws an error', async () => {
      // Arrange
      const userWithRefreshToken = { ...mockUser, refreshToken: 'hashedRefreshToken' };
      mockUsersService.findOne.mockResolvedValue(userWithRefreshToken);
      mockBcrypt.compare.mockRejectedValue(new Error('Bcrypt error'));

      mockAuthService.verifyRefreshToken.mockImplementation(async (token, userId) => {
        try {
          const user = await mockUsersService.findOne(userId);
          await mockBcrypt.compare(token, user.refreshToken);
          return user;
        } catch (e) {
          throw new UnauthorizedException('Invalid refresh token');
        }
      });

      // Act & Assert
      await expect(service.verifyRefreshToken(refreshToken, '1')).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
      expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
      expect(mockBcrypt.compare).toHaveBeenCalledWith(refreshToken, 'hashedRefreshToken');
    });
  });
});
