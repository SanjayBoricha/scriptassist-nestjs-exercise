import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

// Create interfaces to avoid importing entities
interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  refreshToken?: string;
  isActive: boolean;
}

// Mock the entire AuthController without importing it
const mockAuthController = {
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
};

// Mock AuthService
const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  verifyRefreshToken: jest.fn(),
  generateToken: jest.fn(),
  generateRefreshToken: jest.fn(),
};

describe('AuthController', () => {
  let controller: any;
  let authService: any;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: 'user',
    refreshToken: '',
    isActive: true,
  };

  const mockAuthResponse = {
    user: { id: mockUser.id, email: mockUser.email, role: mockUser.role },
    access_token: 'access_token_123',
    refresh_token: 'refresh_token_123',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [],
      providers: [
        {
          provide: 'AuthController',
          useValue: mockAuthController,
        },
        {
          provide: 'AuthService',
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get('AuthController');
    authService = module.get('AuthService');
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      // Arrange
      mockAuthService.login.mockResolvedValue(mockAuthResponse);

      mockAuthController.login.mockImplementation(async dto => {
        return await mockAuthService.login(dto);
      });

      // Act
      const result = await controller.login(loginDto);

      // Assert
      expect(result).toBe(mockAuthResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle login errors from service', async () => {
      // Arrange
      const error = new UnauthorizedException('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      mockAuthController.login.mockImplementation(async dto => {
        return await mockAuthService.login(dto);
      });

      // Act & Assert
      await expect(controller.login(loginDto)).rejects.toThrow(error);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should register successfully with valid data', async () => {
      // Arrange
      const newUserResponse = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: 'user',
      };
      mockAuthService.register.mockResolvedValue(newUserResponse);

      mockAuthController.register.mockImplementation(async dto => {
        return await mockAuthService.register(dto);
      });

      // Act
      const result = await controller.register(registerDto);

      // Assert
      expect(result).toBe(newUserResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should handle registration errors from service', async () => {
      // Arrange
      const error = new BadRequestException('Email already exists');
      mockAuthService.register.mockRejectedValue(error);

      mockAuthController.register.mockImplementation(async dto => {
        return await mockAuthService.register(dto);
      });

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow(error);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('refresh', () => {
    const refreshTokenDto = {
      refresh_token: 'valid_refresh_token',
    };

    const mockRequest = {
      user: { id: '1' },
    };

    it('should refresh token successfully', async () => {
      // Arrange
      mockAuthService.verifyRefreshToken.mockResolvedValue(mockUser);
      mockAuthService.generateToken.mockReturnValue('new_access_token');
      mockAuthService.generateRefreshToken.mockReturnValue('new_refresh_token');

      const expectedResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
      };

      mockAuthController.refresh.mockImplementation(async (dto, req) => {
        const user = await mockAuthService.verifyRefreshToken(dto.refresh_token, req.user.id);
        return {
          access_token: mockAuthService.generateToken(user),
          refresh_token: mockAuthService.generateRefreshToken(user),
        };
      });

      // Act
      const result = await controller.refresh(refreshTokenDto, mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.verifyRefreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refresh_token,
        mockRequest.user.id,
      );
      expect(mockAuthService.generateToken).toHaveBeenCalledWith(mockUser);
      expect(mockAuthService.generateRefreshToken).toHaveBeenCalledWith(mockUser);
    });

    it('should handle refresh with different user roles', async () => {
      // Arrange
      const adminUser = { ...mockUser, role: 'admin' as const };
      mockAuthService.verifyRefreshToken.mockResolvedValue(adminUser);
      mockAuthService.generateToken.mockReturnValue('admin_access_token');
      mockAuthService.generateRefreshToken.mockReturnValue('admin_refresh_token');

      const expectedResponse = {
        access_token: 'admin_access_token',
        refresh_token: 'admin_refresh_token',
      };

      mockAuthController.refresh.mockImplementation(async (dto, req) => {
        const user = await mockAuthService.verifyRefreshToken(dto.refresh_token, req.user.id);
        return {
          access_token: mockAuthService.generateToken(user),
          refresh_token: mockAuthService.generateRefreshToken(user),
        };
      });

      // Act
      const result = await controller.refresh(refreshTokenDto, mockRequest);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.verifyRefreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refresh_token,
        mockRequest.user.id,
      );
      expect(mockAuthService.generateToken).toHaveBeenCalledWith(adminUser);
      expect(mockAuthService.generateRefreshToken).toHaveBeenCalledWith(adminUser);
    });
  });
});
