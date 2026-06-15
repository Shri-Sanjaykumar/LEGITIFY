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

    const { access_token, refresh_token } = json.data;

    // Set refresh token in HttpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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
