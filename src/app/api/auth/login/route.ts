import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required', data: null, errors: [], request_id: '' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      return NextResponse.json(
        {
          success: false,
          message: json.message || 'Authentication failed',
          data: null,
          errors: json.errors || [json.detail || 'Login failed'],
          request_id: json.request_id || '',
        },
        { status: response.status }
      );
    }

    // Extract cookie from backend response
    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    const refreshTokenCookie = setCookies.find(c => c.trim().startsWith('refresh_token='));
    let refreshTokenValue = '';
    if (refreshTokenCookie) {
      refreshTokenValue = refreshTokenCookie.split(';')[0].split('=')[1];
    } else if (json.data && json.data.refresh_token) {
      refreshTokenValue = json.data.refresh_token;
    }

    const access_token = json.data?.access_token;

    // Set refresh token in HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set('refresh_token', refreshTokenValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      data: {
        accessToken: access_token,
      },
      errors: [],
      request_id: json.request_id || '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error in auth proxy',
        data: null,
        errors: [(error as Error).message],
        request_id: '',
      },
      { status: 500 }
    );
  }
}
