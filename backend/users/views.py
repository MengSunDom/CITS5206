from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.conf import settings
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from drf_spectacular.types import OpenApiTypes
import secrets
import string
from .models import User, Profile
from .serializers import (
    UserSerializer,
    RegisterSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ChangePasswordSerializer,
    ProfileSerializer
)


def generate_reset_code():
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(32))


@extend_schema(
    tags=['Authentication'],
    summary='Register a new user',
    description='Create a new user account with email and password. Returns user data and JWT tokens.',
    responses={
        201: OpenApiResponse(
            description='User created successfully',
            response=UserSerializer
        ),
        400: OpenApiResponse(description='Validation error')
    }
)
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        print(f"[DEBUG][RegisterView] 注册新用户: id={user.id}, email={user.email}")
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Authentication'],
    summary='User login',
    description='Authenticate user with email and password. Returns user data and JWT tokens.',
    request=LoginSerializer,
    responses={
        200: OpenApiResponse(
            description='Login successful',
            response=UserSerializer
        ),
        400: OpenApiResponse(description='Invalid credentials')
    }
)
class LoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        print(f"[DEBUG][LoginView] 登录用户: id={getattr(user, 'id', None)}, email={getattr(user, 'email', None)}")
        login(request, user)
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)


@extend_schema(
    tags=['Authentication'],
    summary='User logout',
    description='Logout user and blacklist the refresh token.',
    responses={
        200: OpenApiResponse(description='Logout successful'),
    }
)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            print(f"[DEBUG][LogoutView] 用户登出: id={getattr(request.user, 'id', None)}, email={getattr(request.user, 'email', None)}, refresh_token={refresh_token}")
        except Exception:
            pass
        
        logout(request)
        return Response({'detail': 'Successfully logged out'}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=['User Management'],
        summary='Get user profile',
        description='Retrieve the authenticated user\'s profile information.',
        responses={
            200: UserSerializer,
        }
    )
    def get(self, request):
        print(f"[DEBUG][UserProfileView][GET] request.user: id={getattr(request.user, 'id', None)}, email={getattr(request.user, 'email', None)}, is_authenticated={getattr(request.user, 'is_authenticated', None)}")
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    @extend_schema(
        tags=['User Management'],
        summary='Update user profile',
        description='Update the authenticated user\'s profile information.',
        request=UserSerializer,
        responses={
            200: UserSerializer,
            400: OpenApiResponse(description='Validation error')
        }
    )
    def put(self, request):
        print(f"[DEBUG][UserProfileView][PUT] request.user: id={getattr(request.user, 'id', None)}, email={getattr(request.user, 'email', None)}, is_authenticated={getattr(request.user, 'is_authenticated', None)}")
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        tags=['User Management'],
        summary='Get profile details',
        description='Retrieve specific profile fields like display name, timezone, bio, etc.',
        responses={
            200: ProfileSerializer,
        }
    )
    def get(self, request):
        print(f"[DEBUG][ProfileUpdateView][GET] request.user: id={getattr(request.user, 'id', None)}, email={getattr(request.user, 'email', None)}, is_authenticated={getattr(request.user, 'is_authenticated', None)}")
        profile, created = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)
    
    @extend_schema(
        tags=['User Management'],
        summary='Update profile details',
        description='Update specific profile fields like display name, timezone, bio, etc.',
        request=ProfileSerializer,
        responses={
            200: ProfileSerializer,
            400: OpenApiResponse(description='Validation error')
        }
    )
    def put(self, request):
        print(f"[DEBUG][ProfileUpdateView][PUT] request.user: id={getattr(request.user, 'id', None)}, email={getattr(request.user, 'email', None)}, is_authenticated={getattr(request.user, 'is_authenticated', None)}")
        profile, created = Profile.objects.get_or_create(user=request.user)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(
    tags=['Password Management'],
    summary='Request password reset',
    description='Send a password reset code to the user\'s email address.',
    request=PasswordResetRequestSerializer,
    responses={
        200: OpenApiResponse(description='Reset code sent to email'),
        400: OpenApiResponse(description='Email not found'),
        500: OpenApiResponse(description='Failed to send email')
    }
)
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        user = User.objects.get(email=email)
        print(f"[DEBUG][PasswordResetRequestView] 请求重置: email={email}, user_id={user.id}")
        reset_code = generate_reset_code()
        user.set_reset_code(reset_code)
        
        # Send email with reset code
        try:
            send_mail(
                'Password Reset Code',
                f'Your password reset code is: {reset_code}\n\nThis code will expire in 1 hour.',
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception as e:
            return Response(
                {'detail': 'Failed to send reset email. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response(
            {'detail': 'Password reset code has been sent to your email.'},
            status=status.HTTP_200_OK
        )


@extend_schema(
    tags=['Password Management'],
    summary='Confirm password reset',
    description='Reset password using the code sent to email.',
    request=PasswordResetConfirmSerializer,
    responses={
        200: OpenApiResponse(description='Password reset successful'),
        400: OpenApiResponse(description='Invalid or expired reset code')
    }
)
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']
        print(f"[DEBUG][PasswordResetConfirmView] 重置密码: user_id={user.id}, email={user.email}")
        user.set_password(new_password)
        user.clear_reset_code()
        
        return Response(
            {'detail': 'Password has been reset successfully.'},
            status=status.HTTP_200_OK
        )


@extend_schema(
    tags=['Password Management'],
    summary='Change password',
    description='Change the authenticated user\'s password.',
    request=ChangePasswordSerializer,
    responses={
        200: OpenApiResponse(description='Password changed successfully'),
        400: OpenApiResponse(description='Invalid old password')
    }
)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer
    
    def post(self, request):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        print(f"[DEBUG][ChangePasswordView] 修改密码: user_id={getattr(user, 'id', None)}, email={getattr(user, 'email', None)}, is_authenticated={getattr(user, 'is_authenticated', None)}")
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response(
            {'detail': 'Password changed successfully.'},
            status=status.HTTP_200_OK
        )


@extend_schema(
    tags=['Authentication'],
    summary='Refresh access token',
    description='Get a new access token using a refresh token.',
    request={'refresh': str},
    responses={
        200: OpenApiResponse(description='New access token'),
        400: OpenApiResponse(description='Invalid refresh token')
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_token_view(request):
    try:
        refresh = RefreshToken(request.data.get('refresh'))
        print(f"[DEBUG][refresh_token_view] 刷新token: refresh={request.data.get('refresh')}, user_id={getattr(request.user, 'id', None)}, email={getattr(request.user, 'email', None)}, is_authenticated={getattr(request.user, 'is_authenticated', None)}")
        return Response({
            'access': str(refresh.access_token),
        })
    except Exception as e:
        return Response(
            {'detail': 'Invalid refresh token'},
            status=status.HTTP_400_BAD_REQUEST
        )
